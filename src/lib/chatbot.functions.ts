// Chatbot — The Bench. Deterministic intent router that produces a
// stream override (typed StreamItem[]) and a Bench-voice response line.
// No filter UI exists anywhere in the app; the chatbot IS the filter.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";
import type {
  StreamItem,
  StoryPayload,
  CourtCasePayload,
  HofPayload,
} from "@/lib/stream.functions";

const InputSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type ChatbotResult = {
  data: {
    response_text: string;
    items: StreamItem[];
    clear: boolean;
  } | null;
  error: string | null;
};

// ---------- helpers ----------

function emptyVerdicts(): Record<string, number> { return {}; }

async function postsToStoryItems(
  admin: any,
  rows: any[],
  nominatedSet: Set<string>,
  authors: Record<string, any>,
  verdictCounts: Record<string, Record<string, number>>,
): Promise<StreamItem[]> {
  return rows.map((s: any): StreamItem => {
    const v = verdictCounts[s.id] ?? emptyVerdicts();
    const verdict_total = Object.values(v).reduce((a: number, n: any) => a + (n as number), 0);
    const a = authors[s.author_id] ?? {};
    const payload: StoryPayload = {
      id: s.id,
      title: s.title,
      snippet: String(s.story_text ?? "").slice(0, 220),
      score: Number(s.score ?? 0),
      score_category: s.score_category,
      relate_count: Number(s.relate_count ?? 0),
      comment_count: Number(s.comment_count ?? 0),
      verdict_total,
      verdicts: v,
      both_sides_heard: !!s.both_sides_heard,
      is_seed: !!s.is_seed,
      published_at: s.published_at,
      author_emoji: a.emoji ?? null,
      author_nationality: a.nationality ?? null,
      author_emotion: a.emotion ?? null,
      author_creature: a.creature ?? null,
      is_nominated: nominatedSet.has(s.id),
      media_url: s.media_url ?? null,
      case: null,
    };
    return { type: "story", id: s.id, key: `chat:story:${s.id}`, payload };
  });
}

async function enrichPosts(admin: any, rows: any[]) {
  const ids = rows.map((r: any) => r.id as string);
  const verdictCounts: Record<string, Record<string, number>> = {};
  const nominatedSet = new Set<string>();
  const authors: Record<string, any> = {};
  if (ids.length === 0) return { verdictCounts, nominatedSet, authors };

  const { data: votes } = await admin
    .from("post_verdict_votes").select("post_id, kind").in("post_id", ids);
  for (const v of votes ?? []) {
    const m = (verdictCounts[v.post_id] ??= {});
    m[v.kind] = (m[v.kind] ?? 0) + 1;
  }
  const { data: noms } = await admin
    .from("court_cases").select("post_id").in("post_id", ids).neq("status", "decided");
  for (const n of noms ?? []) nominatedSet.add(n.post_id as string);

  const authorIds = Array.from(new Set(rows.map((s: any) => s.author_id).filter(Boolean)));
  if (authorIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles").select("id, emoji, nationality, emotion, creature").in("id", authorIds);
    for (const p of profs ?? []) authors[(p as any).id] = p;
  }
  return { verdictCounts, nominatedSet, authors };
}

async function courtToItems(admin: any, rows: any[]): Promise<StreamItem[]> {
  if (!rows.length) return [];
  const postIds = rows.map((c: any) => c.post_id as string);
  const { data: cp } = await admin
    .from("posts")
    .select("id, title, score_category, case_title, question_before_court")
    .in("id", postIds);
  const titles: Record<string, any> = {};
  for (const r of cp ?? []) titles[(r as any).id] = r;

  const { data: votes } = await admin
    .from("post_verdict_votes").select("post_id, kind").in("post_id", postIds);
  const counts: Record<string, Record<string, number>> = {};
  for (const v of votes ?? []) {
    const m = (counts[v.post_id] ??= {});
    m[v.kind] = (m[v.kind] ?? 0) + 1;
  }

  return rows.map((c: any): StreamItem => {
    const t = titles[c.post_id] ?? {};
    const v = counts[c.post_id] ?? {};
    const verdict_total = Object.values(v).reduce((a: number, n: any) => a + (n as number), 0);
    const payload: CourtCasePayload = {
      case_id: c.id,
      post_id: c.post_id,
      title: t.title ?? null,
      case_title: t.case_title ?? null,
      question_before_court: t.question_before_court ?? null,
      tier: c.current_tier ?? null,
      region_label: c.region_label ?? null,
      category: c.current_category_court ?? t.score_category ?? null,
      lock_at: c.verdict_lock_at ?? null,
      status: c.status,
      controversy_score: c.controversy_score ?? null,
      final_verdict: c.final_verdict ?? null,
      bench_verdict_line: c.bench_verdict_line ?? null,
      verdicts: v,
      verdict_total,
    };
    return { type: "court_case", id: c.id, key: `chat:case:${c.id}`, payload };
  });
}

async function hofToItems(admin: any, rows: any[]): Promise<StreamItem[]> {
  if (!rows.length) return [];
  const { HOF_CATEGORIES } = await import("@/lib/hof-categories");
  const out: StreamItem[] = [];
  let rank = 0;
  for (const r of rows) {
    rank += 1;
    const cat = HOF_CATEGORIES.find((c) => c.key === r.category);
    let title: string | null = (r.metrics?.title as string) ?? null;
    let alias_label: string | null = null;
    let alias_emoji: string | null = null;
    let post_id: string | null = null;
    try {
      if (r.entity_type === "story") {
        const { data: p } = await admin
          .from("posts").select("id, case_title, title").eq("id", r.entity_id).maybeSingle();
        title = (p as any)?.case_title ?? (p as any)?.title ?? title;
        post_id = (p as any)?.id ?? null;
      } else if (r.entity_type === "case") {
        const { data: cc } = await admin
          .from("court_cases").select("post_id").eq("id", r.entity_id).maybeSingle();
        post_id = (cc as any)?.post_id ?? null;
        if (post_id) {
          const { data: p } = await admin
            .from("posts").select("case_title, title").eq("id", post_id).maybeSingle();
          title = (p as any)?.case_title ?? (p as any)?.title ?? title;
        }
      } else if (r.entity_type === "user") {
        const { data: prof } = await admin
          .from("profiles").select("nickname, handle, emoji").eq("id", r.entity_id).maybeSingle();
        alias_label = (prof as any)?.nickname ?? (prof as any)?.handle ?? null;
        alias_emoji = (prof as any)?.emoji ?? "👤";
      }
    } catch { /* graceful */ }
    const payload: HofPayload = {
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      period: r.period,
      category: r.category,
      rank,
      score: Number(r.score ?? 0),
      title,
      alias_label,
      alias_emoji,
      verdict_pct: null,
      juror_count: null,
      juror_title: null,
      bench_line: cat?.benchLine ?? null,
      post_id,
    };
    out.push({ type: "hof", id: `${r.entity_type}:${r.entity_id}`, key: `chat:hof:${r.category}:${r.entity_id}`, payload });
  }
  return out;
}

// ---------- intent router ----------

interface Intent {
  kind: "clear" | "hof" | "court" | "city" | "heartbreak" | "controversial_ever" | "less_alone" | "category" | "generic";
  query?: string;
  city?: string;
  category?: string;       // hof category key OR score_category
  period?: "daily" | "weekly" | "monthly" | "all";
  entity?: "case" | "story" | "user";
}

function parseIntent(raw: string): Intent {
  const q = raw.toLowerCase().trim();

  if (/^(back|home|reset|clear|stream|show me everything|everything|nevermind|never mind)$/.test(q)) {
    return { kind: "clear" };
  }

  // Most controversial ever / all-time
  if (/(most\s+controversial).*(ever|all.?time|of all time)/.test(q) || /controversial.*alltime/.test(q)) {
    return { kind: "controversial_ever" };
  }

  // HOF / leaderboard / "who's winning"
  if (/(hall of fame|\bhof\b|leaderboard|who'?s winning|top juror|most dramatic|most controversial|most relatable|most shocking|most surprising|biggest red flag|biggest green flag|sharpest steelman|top predictor)/.test(q)) {
    const period: Intent["period"] =
      /today|daily/.test(q) ? "daily"
      : /this\s+week|weekly|\bweek\b/.test(q) ? "weekly"
      : /this\s+month|monthly|\bmonth\b/.test(q) ? "monthly"
      : /all.?time|ever/.test(q) ? "all"
      : "weekly";
    const entity: Intent["entity"] =
      /juror|user|predictor|steelman|alias/.test(q) ? "user"
      : /story|stories/.test(q) ? "story"
      : "case";
    let category = "most_dramatic";
    if (/controversial/.test(q)) category = "most_controversial";
    else if (/relatable/.test(q)) category = "most_relatable";
    else if (/shocking/.test(q)) category = "most_shocking";
    else if (/surprising/.test(q)) category = "most_surprising";
    else if (/red.?flag/.test(q)) category = "biggest_red_flag";
    else if (/green.?flag/.test(q)) category = "biggest_green_flag";
    else if (/predictor/.test(q)) category = "most_accurate_predictor";
    else if (/juror/.test(q)) category = "top_juror";
    else if (/steelman/.test(q)) category = "sharpest_steelman";
    return { kind: "hof", category, period, entity };
  }

  // World court / what's in court
  if (/world court|world cases|in court right now|what'?s (in|on) court|active cases|court (right )?now/.test(q)) {
    return { kind: "court" };
  }

  // Heartbreak
  if (/heart[\s-]?break|broken heart|breakup|break.?up|dumped|ex\b/.test(q)) {
    return { kind: "heartbreak" };
  }

  // Less alone / relatable
  if (/less alone|feel.*alone|relatable|been there|same boat/.test(q)) {
    return { kind: "less_alone" };
  }

  // [City] drama, drama in [city], stories from [city]
  const cityMatch =
    q.match(/(?:show me\s+)?(?:drama|stories|tea|cases)\s+(?:in|from)\s+([a-z][a-z\s\-]{1,30})/) ||
    q.match(/([a-z][a-z\s\-]{1,30})\s+drama/);
  if (cityMatch) {
    return { kind: "city", city: cityMatch[1].trim() };
  }

  // category-style keywords
  if (/family/.test(q)) return { kind: "category", category: "family" };
  if (/work|boss|colleague/.test(q)) return { kind: "category", category: "work" };
  if (/friend/.test(q)) return { kind: "category", category: "friendship" };
  if (/money|finance/.test(q)) return { kind: "category", category: "money" };

  return { kind: "generic", query: q };
}

const COURT_TIER_LABEL: Record<string, string> = {
  city: "City Court", regional: "Regional Court", national: "National Court", world: "World Court",
};

// ---------- handler ----------

export const chat = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ChatbotResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const intent = parseIntent(data.message);

    try {
      switch (intent.kind) {
        case "clear":
          return { data: { response_text: "Stream restored. The bench steps back.", items: [], clear: true }, error: null };

        case "hof": {
          const { data: rows } = await admin
            .from("hof_scores")
            .select("entity_type, entity_id, period, category, score, metrics")
            .eq("period", intent.period ?? "weekly")
            .eq("category", intent.category ?? "most_dramatic")
            .eq("entity_type", intent.entity ?? "case")
            .order("score", { ascending: false })
            .limit(10);
          const items = await hofToItems(admin, rows ?? []);
          const periodWord = intent.period === "daily" ? "today" : intent.period === "monthly" ? "this month" : intent.period === "all" ? "of all time" : "this week";
          const text = items.length
            ? `The bench called the standings ${periodWord}. Top of the docket below.`
            : `Nothing has cleared the bar ${periodWord}. The bench waits.`;
          return { data: { response_text: text, items, clear: false }, error: null };
        }

        case "controversial_ever": {
          const { data: rows } = await admin
            .from("hof_scores")
            .select("entity_type, entity_id, period, category, score, metrics")
            .eq("period", "all")
            .eq("category", "most_controversial")
            .order("score", { ascending: false })
            .limit(5);
          let items = await hofToItems(admin, rows ?? []);
          if (!items.length) {
            const { data: cc } = await admin
              .from("court_cases")
              .select("id, post_id, scope, region_label, status, current_tier, current_category_court, verdict_lock_at, controversy_score, final_verdict, bench_verdict_line")
              .order("controversy_score", { ascending: false })
              .limit(5);
            items = await courtToItems(admin, cc ?? []);
          }
          return { data: { response_text: "Hung juries. Split rooms. The cases that wouldn't settle.", items, clear: false }, error: null };
        }

        case "court": {
          const { data: rows } = await admin
            .from("court_cases")
            .select("id, post_id, scope, region_label, status, current_tier, current_category_court, verdict_lock_at, controversy_score, final_verdict, bench_verdict_line")
            .eq("scope", "world")
            .eq("status", "in_court")
            .order("verdict_lock_at", { ascending: true })
            .limit(10);
          let items = await courtToItems(admin, rows ?? []);
          if (!items.length) {
            const { data: any2 } = await admin
              .from("court_cases")
              .select("id, post_id, scope, region_label, status, current_tier, current_category_court, verdict_lock_at, controversy_score, final_verdict, bench_verdict_line")
              .in("status", ["in_court", "legendary"])
              .order("verdict_lock_at", { ascending: true })
              .limit(10);
            items = await courtToItems(admin, any2 ?? []);
          }
          const text = items.length ? "World Court, in session. Read fast — the gavel is loaded." : "World Court is quiet. The room is between hearings.";
          return { data: { response_text: text, items, clear: false }, error: null };
        }

        case "city": {
          const cityRaw = (intent.city ?? "").replace(/\s+/g, " ").trim();
          const pretty = cityRaw.replace(/\b\w/g, (m) => m.toUpperCase());
          const like = `%${cityRaw}%`;
          const { data: rows } = await admin
            .from("posts")
            .select("id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url, drama_score")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .or(`title.ilike.${like},story_text.ilike.${like}`)
            .order("drama_score", { ascending: false })
            .limit(20);
          const { verdictCounts, nominatedSet, authors } = await enrichPosts(admin, rows ?? []);
          const items = await postsToStoryItems(admin, rows ?? [], nominatedSet, authors, verdictCounts);
          const text = items.length ? `${pretty}, sorted by drama. The bench warmed up.` : `${pretty} is quiet on the docket. The bench heard you.`;
          return { data: { response_text: text, items, clear: false }, error: null };
        }

        case "heartbreak": {
          const { data: rows } = await admin
            .from("posts")
            .select("id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .in("score_category", ["romantic", "family"])
            .order("relate_count", { ascending: false })
            .limit(20);
          const { verdictCounts, nominatedSet, authors } = await enrichPosts(admin, rows ?? []);
          const items = await postsToStoryItems(admin, rows ?? [], nominatedSet, authors, verdictCounts);
          return { data: { response_text: "The room has been here. Read at your own pace.", items, clear: false }, error: null };
        }

        case "less_alone": {
          const { data: rows } = await admin
            .from("posts")
            .select("id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("relate_count", { ascending: false })
            .limit(20);
          const { verdictCounts, nominatedSet, authors } = await enrichPosts(admin, rows ?? []);
          const items = await postsToStoryItems(admin, rows ?? [], nominatedSet, authors, verdictCounts);
          return { data: { response_text: "You're not the first. Here's the rest of the room.", items, clear: false }, error: null };
        }

        case "category": {
          const cat = intent.category!;
          const { data: rows } = await admin
            .from("posts")
            .select("id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .eq("score_category", cat)
            .order("published_at", { ascending: false })
            .limit(20);
          const { verdictCounts, nominatedSet, authors } = await enrichPosts(admin, rows ?? []);
          const items = await postsToStoryItems(admin, rows ?? [], nominatedSet, authors, verdictCounts);
          return { data: { response_text: `${cat[0].toUpperCase()}${cat.slice(1)} cases, freshest first.`, items, clear: false }, error: null };
        }

        case "generic":
        default: {
          const like = `%${(intent.query ?? "").replace(/[%_]/g, " ").slice(0, 60)}%`;
          const { data: rows } = await admin
            .from("posts")
            .select("id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .or(`title.ilike.${like},story_text.ilike.${like}`)
            .order("published_at", { ascending: false })
            .limit(20);
          const { verdictCounts, nominatedSet, authors } = await enrichPosts(admin, rows ?? []);
          const items = await postsToStoryItems(admin, rows ?? [], nominatedSet, authors, verdictCounts);
          const text = items.length
            ? "The bench pulled what fits. Read or ask sharper."
            : "Nothing matched. Ask the bench again, plainer.";
          return { data: { response_text: text, items, clear: false }, error: null };
        }
      }
    } catch (e) {
      return { data: null, error: (e as Error)?.message ?? "chatbot_failed" };
    }
  });

// Reference (suppresses unused warning when tier label is needed later).
void COURT_TIER_LABEL;

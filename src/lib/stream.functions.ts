// Stream composer — typed cards for the AI-native single-surface feed.
// Returns a mix of stories, court cases, HOF entries, Bench moments, and CTAs.
// Anonymous callers receive only public, non-personal types.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type StreamItem =
  | { type: "story"; id: string; key: string; payload: StoryPayload }
  | { type: "court_case"; id: string; key: string; payload: CourtCasePayload }
  | { type: "spill_cta"; id: string; key: string; payload: { headline: string; sub: string } }
  | { type: "scan_cta"; id: string; key: string; payload: { headline: string; sub: string } }
  | { type: "hof"; id: string; key: string; payload: HofPayload }
  | { type: "bench_moment"; id: string; key: string; payload: { line: string } }
  | { type: "service"; id: string; key: string; payload: { headline: string; sub: string } };

export interface StoryPayload {
  id: string;
  title: string | null;
  snippet: string;
  score: number;
  score_category: string | null;
  relate_count: number;
  comment_count: number;
  verdict_total: number;
  verdicts: Record<string, number>;
  both_sides_heard: boolean;
  is_seed: boolean;
  published_at: string;
  author_emoji: string | null;
  author_nationality: string | null;
  author_emotion: string | null;
  author_creature: string | null;
  is_nominated: boolean;
  media_url: string | null;
  case?: { tier: string | null; lock_at: string | null; region_label: string | null; category: string | null } | null;
}

export interface CourtCasePayload {
  case_id: string;
  post_id: string;
  title: string | null;
  tier: string | null;
  region_label: string | null;
  category: string | null;
  lock_at: string | null;
  status: string;
  controversy_score: number | null;
}

export interface HofPayload {
  entity_type: string;
  entity_id: string;
  period: string;
  score: number;
  title: string | null;
}

const CursorSchema = z
  .object({
    cursor: z.string().nullish(),
    limit: z.number().int().min(1).max(40).default(20),
    anonymous: z.boolean().default(false),
  })
  .strict();

function decodeCursor(c?: string | null): { published_at: string; id: string } | null {
  if (!c) return null;
  const [p, id] = c.split("|");
  if (!p || !id) return null;
  return { published_at: p, id };
}
function encodeCursor(published_at: string, id: string) { return `${published_at}|${id}`; }

const BENCH_FALLBACK: string[] = [
  "Three stories in. Two verdicts cast. The bench is watching.",
  "Read. Weigh in. Move on.",
  "Hung jury today. The bench will keep listening.",
  "A verdict without a witness is just an opinion.",
];

export const composeStream = createServerFn({ method: "POST" })
  .inputValidator((d) => CursorSchema.parse(d))
  .handler(async ({ data }): Promise<{ items: StreamItem[]; next_cursor: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cursor, limit, anonymous } = data;
    const cur = decodeCursor(cursor);

    // 1. Pull stories. Anonymous viewers (landing) still see the docket —
    // posts are public; only personal/CTAs are gated below.
    const storyLimit = anonymous ? Math.ceil(limit * 0.7) : Math.ceil(limit * 0.6);
    let stories: any[] = [];
    if (storyLimit > 0) {
      let q = supabaseAdmin
        .from("posts")
        .select(
          "id, title, story_text, score, score_category, relate_count, comment_count, both_sides_heard, is_seed, published_at, author_id, media_url",
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(storyLimit + 1);
      if (cur) {
        q = q.or(
          `published_at.lt.${cur.published_at},and(published_at.eq.${cur.published_at},id.lt.${cur.id})`,
        );
      }
      const { data: rows } = await q;
      stories = rows ?? [];
    }

    // 2. Active court cases
    const { data: courtRows } = await supabaseAdmin
      .from("court_cases")
      .select(
        "id, post_id, scope, region_label, status, current_tier, current_category_court, verdict_lock_at, controversy_score",
      )
      .eq("status", "in_court")
      .order("verdict_lock_at", { ascending: true })
      .limit(4);

    const postIds = [
      ...stories.map((s) => s.id as string),
      ...((courtRows ?? []).map((c: any) => c.post_id as string)),
    ];

    // 3. Enrich: verdicts, authors, nominations
    let verdictCounts: Record<string, Record<string, number>> = {};
    let nominatedSet = new Set<string>();
    let authors: Record<string, any> = {};
    if (postIds.length > 0) {
      const { data: votes } = await supabaseAdmin
        .from("post_verdict_votes")
        .select("post_id, kind")
        .in("post_id", postIds);
      for (const v of votes ?? []) {
        const m = (verdictCounts[v.post_id] ??= {});
        m[v.kind] = (m[v.kind] ?? 0) + 1;
      }
      const { data: noms } = await supabaseAdmin
        .from("court_cases")
        .select("post_id")
        .in("post_id", postIds)
        .neq("status", "decided");
      for (const n of noms ?? []) nominatedSet.add(n.post_id as string);

      const authorIds = Array.from(new Set(stories.map((s) => s.author_id).filter(Boolean)));
      if (authorIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, emoji, nationality, emotion, creature")
          .in("id", authorIds);
        for (const p of profs ?? []) authors[(p as any).id] = p;
      }
    }

    // 4. Fetch titles for court cases (so the card has something to render)
    let courtTitles: Record<string, { title: string | null; category: string | null }> = {};
    const courtPostIds = (courtRows ?? []).map((c: any) => c.post_id as string);
    if (courtPostIds.length > 0) {
      const { data: cp } = await supabaseAdmin
        .from("posts")
        .select("id, title, score_category")
        .in("id", courtPostIds);
      for (const r of cp ?? []) {
        courtTitles[(r as any).id] = { title: (r as any).title, category: (r as any).score_category };
      }
    }

    // 5. HOF tile (top entry, current week)
    let hof: HofPayload | null = null;
    const { data: hofRows } = await supabaseAdmin
      .from("hof_scores")
      .select("entity_type, entity_id, period, score, metrics")
      .order("score", { ascending: false })
      .limit(1);
    if (hofRows && hofRows.length > 0) {
      const h: any = hofRows[0];
      hof = {
        entity_type: h.entity_type,
        entity_id: h.entity_id,
        period: h.period,
        score: Number(h.score ?? 0),
        title: (h.metrics?.title as string) ?? null,
      };
    }

    // 6. Bench moment line
    const { data: benchRows } = await supabaseAdmin
      .from("bench_voice_strings")
      .select("key, text")
      .limit(20);
    const benchLines = (benchRows ?? []).map((b: any) => b.text as string).filter(Boolean);
    const pool = benchLines.length > 0 ? benchLines : BENCH_FALLBACK;
    const benchLine = pool[Math.floor(Math.random() * pool.length)];

    // 7. Assemble items
    const items: StreamItem[] = [];

    for (const c of (courtRows ?? []).slice(0, 2)) {
      const t = courtTitles[c.post_id] ?? { title: null, category: null };
      items.push({
        type: "court_case",
        id: c.id,
        key: `case:${c.id}`,
        payload: {
          case_id: c.id,
          post_id: c.post_id,
          title: t.title,
          tier: c.current_tier,
          region_label: c.region_label,
          category: c.current_category_court ?? t.category,
          lock_at: c.verdict_lock_at,
          status: c.status,
          controversy_score: c.controversy_score,
        },
      });
    }

    const sliceStories = stories.slice(0, storyLimit);
    let lastPublished: string | null = null;
    let lastId: string | null = null;
    sliceStories.forEach((s: any, idx: number) => {
      lastPublished = s.published_at;
      lastId = s.id;
      const a = authors[s.author_id] ?? {};
      const v = verdictCounts[s.id] ?? {};
      const verdict_total = Object.values(v).reduce((acc: number, n: any) => acc + (n as number), 0);
      items.push({
        type: "story",
        id: s.id,
        key: `story:${s.id}`,
        payload: {
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
          case: null,
        },
      });

      // Sprinkle CTAs / HOF / Bench moments
      const pos = idx + 1;
      if (!anonymous && pos % 4 === 0) {
        items.push({
          type: "spill_cta",
          id: `spill-${idx}`,
          key: `spill-cta:${idx}`,
          payload: {
            headline: "Hand the bench your story.",
            sub: "Two minutes. The room reads it tonight.",
          },
        });
      }
      if (pos % 6 === 0) {
        items.push({
          type: "scan_cta",
          id: `scan-${idx}`,
          key: `scan-cta:${idx}`,
          payload: {
            headline: "Drop the screenshot. Get the read.",
            sub: "The bench will scan, not soothe.",
          },
        });
      }
      if (pos === 3 && hof) {
        items.push({ type: "hof", id: `hof-${idx}`, key: `hof:${hof.entity_id}`, payload: hof });
      }
      if (pos === 2) {
        items.push({
          type: "bench_moment",
          id: `bench-${idx}`,
          key: `bench:${idx}:${benchLine.slice(0, 8)}`,
          payload: { line: benchLine },
        });
      }
    });

    if (anonymous && hof) {
      items.push({ type: "hof", id: `hof-a`, key: `hof:${hof.entity_id}`, payload: hof });
      items.push({
        type: "bench_moment",
        id: `bench-a`,
        key: `bench:a`,
        payload: { line: benchLine },
      });
      items.push({
        type: "scan_cta",
        id: `scan-a`,
        key: `scan-cta:a`,
        payload: {
          headline: "Not sure where you stand?",
          sub: "Drop the screenshot. The bench reads.",
        },
      });
    }

    const next_cursor =
      sliceStories.length >= storyLimit && lastPublished && lastId
        ? encodeCursor(lastPublished, lastId)
        : null;

    return { items, next_cursor };
  });

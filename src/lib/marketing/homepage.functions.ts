// Marketing homepage data: total verdicts, 3 live cases, 1 resolved case w/ outcome,
// HOF band stats + top entries, and a recent story stream.
// Server-only via service role; returns plain DTOs for SSR.
import { createServerFn } from "@tanstack/react-start";

export type LiveCase = {
  caseId: string;
  postId: string;
  title: string;
  courtBadge: string;
  closesAt: string | null;
  topVerdictKind: string | null;
  topVerdictPct: number;
};

export type ResolvedCase = {
  caseId: string;
  postId: string;
  title: string;
  verdictKind: string | null;
  verdictPct: number;
  outcomeSnippet: string;
  daysToOutcome: number;
};

export type HofEntry = {
  entityType: "story" | "case" | "user" | string;
  entityId: string;
  postId: string | null;
  title: string;
  category: string;
  score: number;
};

export type HofStats = {
  verdictsThisWeek: number;
  casesDecided: number;
  unanimousPct: number;
};

export type StreamStory = {
  postId: string;
  title: string;
  category: string | null;
  snippet: string;
  createdAt: string;
  commentCount: number;
  viewCount: number;
  authorAlias: string;
  authorCreature: string | null;
};


export type HomepageData = {
  totalVerdicts: number;
  liveCases: LiveCase[];
  resolvedCase: ResolvedCase | null;
  hofStats: HofStats;
  hofEntries: HofEntry[];
  streamStories: StreamStory[];
};

function topVerdict(rows: Array<{ kind: string | null; quarantined: boolean | null }>): { kind: string | null; pct: number } {
  const valid = rows.filter((r) => !r.quarantined && r.kind);
  const total = valid.length;
  if (total === 0) return { kind: null, pct: 0 };
  const counts = new Map<string, number>();
  for (const r of valid) counts.set(r.kind!, (counts.get(r.kind!) ?? 0) + 1);
  let bestKind: string | null = null;
  let best = 0;
  for (const [k, c] of counts) if (c > best) { best = c; bestKind = k; }
  return { kind: bestKind, pct: Math.round((best / total) * 100) };
}

export const getHomepageData = createServerFn({ method: "GET" }).handler(async (): Promise<HomepageData> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { count: totalVerdicts },
    { data: liveRaw },
    { data: outcomes },
    { count: verdictsThisWeek },
    { data: decidedCases },
    { data: hofRaw },
    { data: streamRaw },
  ] = await Promise.all([
    supabaseAdmin.from("post_verdict_votes").select("post_id", { count: "exact", head: true }),
    supabaseAdmin
      .from("court_cases")
      .select("id, post_id, region_label, current_category_court, closes_at, verdict_lock_at, nominated_at, posts!inner(title, status, visibility, deleted_at)")
      .eq("status", "in_court")
      .eq("posts.status", "published")
      .eq("posts.visibility", "public")
      .is("posts.deleted_at", null)
      .order("nominated_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("story_outcomes")
      .select("post_id, outcome_type, detail, created_at, days_elapsed")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("post_verdict_votes")
      .select("post_id", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabaseAdmin
      .from("court_cases")
      .select("id, post_id")
      .eq("status", "decided")
      .limit(500),
    supabaseAdmin
      .from("hof_scores")
      .select("entity_type, entity_id, category, score, metrics")
      .eq("period", "weekly")
      .order("score", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("posts")
      .select("id, title, case_title, story_text, score_category, created_at, comment_count, view_count, status, visibility, deleted_at, author_id")
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  // Resolve author profiles for the stream separately (no FK hint to profiles).
  const streamAuthorIds = Array.from(
    new Set(((streamRaw ?? []) as any[]).map((p) => p.author_id).filter(Boolean)),
  ) as string[];
  const profilesById = new Map<string, { nickname: string | null; creature: string | null }>();
  if (streamAuthorIds.length) {
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("id, nickname, creature")
      .in("id", streamAuthorIds);
    for (const row of (profRows ?? []) as any[]) {
      profilesById.set(row.id as string, { nickname: row.nickname ?? null, creature: row.creature ?? null });
    }
  }


  // Live cases
  const cases = (liveRaw ?? []) as any[];
  const liveCases: LiveCase[] = [];
  for (const c of cases) {
    if (liveCases.length >= 3) break;
    const { data: votes } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("kind, quarantined")
      .eq("post_id", c.post_id)
      .limit(500);
    const tv = topVerdict((votes ?? []) as any[]);
    const courtType = (c.current_category_court as string | null)?.replace(/_/g, " ") ?? null;
    const courtBadge = [c.region_label, courtType ? `${courtType[0].toUpperCase()}${courtType.slice(1)} Court` : null]
      .filter(Boolean).join(" · ");
    liveCases.push({
      caseId: c.id,
      postId: c.post_id,
      title: c.posts?.title ?? "Untitled case",
      courtBadge: courtBadge || "Open Court",
      closesAt: c.verdict_lock_at ?? c.closes_at ?? null,
      topVerdictKind: tv.kind,
      topVerdictPct: tv.pct,
    });
  }

  // Resolved case
  let resolvedCase: ResolvedCase | null = null;
  for (const o of (outcomes ?? []) as any[]) {
    const { data: post } = await supabaseAdmin
      .from("posts").select("id, title, status, visibility, deleted_at")
      .eq("id", o.post_id).maybeSingle();
    if (!post || post.status !== "published" || post.visibility !== "public" || post.deleted_at) continue;
    const { data: cc } = await supabaseAdmin
      .from("court_cases").select("id, final_verdict, decided_at")
      .eq("post_id", o.post_id).eq("status", "decided").order("decided_at", { ascending: false }).maybeSingle();
    if (!cc) continue;
    const { data: votes } = await supabaseAdmin
      .from("post_verdict_votes").select("kind, quarantined").eq("post_id", o.post_id).limit(1000);
    const tv = topVerdict((votes ?? []) as any[]);
    const raw = (o.detail as string | null) ?? "";
    const snippet = raw.length > 220 ? raw.slice(0, 220).trimEnd() + "…" : raw;
    resolvedCase = {
      caseId: cc.id,
      postId: post.id,
      title: post.title ?? "Untitled case",
      verdictKind: tv.kind ?? (cc.final_verdict as string | null) ?? null,
      verdictPct: tv.pct,
      outcomeSnippet: snippet,
      daysToOutcome: Math.max(0, Number(o.days_elapsed ?? 0)),
    };
    break;
  }

  // HOF band: stats + top 3 entries (resolve titles)
  const decided = (decidedCases ?? []) as any[];
  let unanimousCount = 0;
  // Sample-based unanimous detection: a case is "unanimous" if its winning verdict pct >= 80.
  const sample = decided.slice(0, 40);
  for (const c of sample) {
    const { data: v } = await supabaseAdmin
      .from("post_verdict_votes").select("kind, quarantined").eq("post_id", c.post_id).limit(500);
    const tv = topVerdict((v ?? []) as any[]);
    if (tv.pct >= 80) unanimousCount++;
  }
  const unanimousPct = sample.length === 0 ? 0 : Math.round((unanimousCount / sample.length) * 100);

  const hofEntries: HofEntry[] = [];
  for (const row of (hofRaw ?? []) as any[]) {
    if (hofEntries.length >= 3) break;
    let title: string = (row.metrics?.title as string) ?? "Untitled";
    let postId: string | null = null;
    try {
      if (row.entity_type === "story") {
        const { data: post } = await supabaseAdmin
          .from("posts").select("id, case_title, title, status, visibility, deleted_at")
          .eq("id", row.entity_id).maybeSingle();
        if (!post || (post as any).status !== "published" || (post as any).visibility !== "public" || (post as any).deleted_at) continue;
        title = (post as any).case_title ?? (post as any).title ?? title;
        postId = (post as any).id;
      } else if (row.entity_type === "case") {
        const { data: c } = await supabaseAdmin
          .from("court_cases").select("post_id").eq("id", row.entity_id).maybeSingle();
        postId = (c as any)?.post_id ?? null;
        if (postId) {
          const { data: post } = await supabaseAdmin
            .from("posts").select("case_title, title, status, visibility, deleted_at")
            .eq("id", postId).maybeSingle();
          if (!post || (post as any).status !== "published" || (post as any).visibility !== "public" || (post as any).deleted_at) continue;
          title = (post as any).case_title ?? (post as any).title ?? title;
        }
      } else if (row.entity_type === "user") {
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("nickname, handle").eq("id", row.entity_id).maybeSingle();
        title = (prof as any)?.nickname ?? (prof as any)?.handle ?? "Anonymous";
      }
    } catch { /* skip */ }
    hofEntries.push({
      entityType: row.entity_type,
      entityId: row.entity_id,
      postId,
      title,
      category: row.category ?? "honored",
      score: Math.round(Number(row.score ?? 0)),
    });
  }

  // Story stream
  const streamStories: StreamStory[] = ((streamRaw ?? []) as any[]).map((p) => {
    const raw = (p.story_text as string | null) ?? "";
    const snippet = raw.length > 180 ? raw.slice(0, 180).trimEnd() + "…" : raw;
    const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      postId: p.id,
      title: p.case_title ?? p.title ?? "Untitled story",
      category: (p.score_category as string | null) ?? null,
      snippet,
      createdAt: p.created_at,
      commentCount: Number(p.comment_count ?? 0),
      viewCount: Number(p.view_count ?? 0),
      authorAlias: (prof?.nickname as string | null) ?? "Anonymous",
      authorCreature: (prof?.creature as string | null) ?? null,
    };
  });


  return {
    totalVerdicts: totalVerdicts ?? 0,
    liveCases,
    resolvedCase,
    hofStats: {
      verdictsThisWeek: verdictsThisWeek ?? 0,
      casesDecided: decided.length,
      unanimousPct,
    },
    hofEntries,
    streamStories,
  };
});

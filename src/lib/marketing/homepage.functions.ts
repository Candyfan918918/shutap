// Marketing homepage data: total verdicts, 3 live cases, 1 resolved case w/ outcome.
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

export type HomepageData = {
  totalVerdicts: number;
  liveCases: LiveCase[];
  resolvedCase: ResolvedCase | null;
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

  const [{ count: totalVerdicts }, { data: liveRaw }, { data: outcomes }] = await Promise.all([
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
  ]);

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

  return {
    totalVerdicts: totalVerdicts ?? 0,
    liveCases,
    resolvedCase,
  };
});

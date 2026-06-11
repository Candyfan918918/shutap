// Public AEO case page data. Server-only, service role. Returns plain DTO for SSR.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Comment = { id: string; body: string; alias: string; likeCount: number };
export type SimilarCase = { postId: string; title: string };
export type CasePageData = {
  postId: string;
  caseTitle: string;
  alias: string;
  storyText: string;
  questionBeforeCourt: string;
  createdAt: string;
  updatedAt: string;
  conflictType: string | null;
  // verdict
  totalVotes: number;
  dominantVerdict: string | null;
  dominantVerdictPct: number;
  dominantVerdictCount: number;
  verdictLockAt: string | null;
  benchVerdictLine: string | null;
  // emotional reaction
  topReactionKind: string | null;
  topReactionPct: number;
  // themes
  majorityTheme: string | null;
  minorityTheme: string | null;
  // outcome
  outcomeType: string | null;
  outcomeDetail: string | null;
  daysToOutcome: number | null;
  outcomeAt: string | null;
  // counsel
  counselComments: Comment[];
  commentCount: number;
  // pattern (≥20 cases)
  patternStat: { totalSimilar: number; agreedPct: number } | null;
  similarCases: SimilarCase[];
};

const VERDICT_KINDS = new Set(["not_guilty", "guilty", "no_verdict", "talk_it_out", "therapy_might_help", "lawyer_up", "need_update"]);
const REACTION_KINDS = new Set(["red_flag", "green_flag", "run"]);

function aliasFromProfile(p: Record<string, any> | null): string {
  if (!p) return "Anonymous";
  const parts = [p.descriptor, p.emotion, p.creature].filter(Boolean);
  if (parts.length > 0) return parts.join(" ").replace(/\b\w/g, (s) => s.toUpperCase());
  return p.nickname ?? "Anonymous";
}

function tally(rows: Array<{ kind: string | null; quarantined?: boolean | null }>) {
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (r.quarantined) continue;
    if (!r.kind) continue;
    counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    total++;
  }
  let topKind: string | null = null;
  let topCount = 0;
  for (const [k, c] of counts) if (c > topCount) { topKind = k; topCount = c; }
  return { total, topKind, topCount, counts };
}

export const getCasePage = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<CasePageData | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, title, case_title, question_before_court, story_text, score_category, author_id, created_at, updated_at, comment_count, status, visibility, deleted_at")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || post.status !== "published" || post.visibility !== "public" || post.deleted_at) return null;

    const [{ data: cc }, { data: profile }, { data: votes }, { data: aiSum }, { data: outcome }, { data: comments }] =
      await Promise.all([
        supabaseAdmin.from("court_cases").select("bench_verdict_line, final_verdict, verdict_lock_at, decided_at")
          .eq("post_id", post.id).order("nominated_at", { ascending: false }).maybeSingle(),
        supabaseAdmin.from("profiles").select("descriptor, emotion, creature, nickname").eq("id", post.author_id).maybeSingle(),
        supabaseAdmin.from("post_verdict_votes").select("kind, quarantined").eq("post_id", post.id).limit(5000),
        supabaseAdmin.from("comment_ai_summaries").select("majority_theme, minority_theme, majority_verdict").eq("post_id", post.id).maybeSingle(),
        supabaseAdmin.from("story_outcomes").select("outcome_type, detail, days_elapsed, created_at").eq("post_id", post.id).order("created_at", { ascending: false }).maybeSingle(),
        supabaseAdmin.from("post_comments")
          .select("id, body, user_id, like_count, is_counsel_pick, status, deleted_at")
          .eq("post_id", post.id).is("deleted_at", null).eq("status", "published")
          .order("like_count", { ascending: false }).limit(8),
      ]);

    const allVotes = (votes ?? []) as any[];
    const verdictVotes = allVotes.filter((v) => v.kind && !REACTION_KINDS.has(v.kind));
    const reactionVotes = allVotes.filter((v) => v.kind && REACTION_KINDS.has(v.kind));
    const v = tally(verdictVotes);
    const r = tally(reactionVotes);

    // Counsel comments — fetch aliases
    const userIds = Array.from(new Set(((comments ?? []) as any[]).map((c) => c.user_id).filter(Boolean)));
    const aliasMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin.from("profiles")
        .select("id, descriptor, emotion, creature, nickname").in("id", userIds);
      for (const p of (profs ?? []) as any[]) aliasMap.set(p.id, aliasFromProfile(p));
    }
    const counselComments: Comment[] = ((comments ?? []) as any[]).slice(0, 3).map((c) => ({
      id: c.id,
      body: c.body ?? "",
      alias: aliasMap.get(c.user_id) ?? "Anonymous",
      likeCount: c.like_count ?? 0,
    }));

    // Pattern stat — same score_category
    let patternStat: CasePageData["patternStat"] = null;
    const similarCases: SimilarCase[] = [];
    if (post.score_category) {
      const { data: similar } = await supabaseAdmin
        .from("posts")
        .select("id, title, case_title")
        .eq("score_category", post.score_category)
        .eq("status", "published").eq("visibility", "public").is("deleted_at", null)
        .neq("id", post.id)
        .order("published_at", { ascending: false }).limit(80);
      const ids = ((similar ?? []) as any[]).map((s) => s.id);
      if (ids.length >= 20) {
        const { data: agreed } = await supabaseAdmin
          .from("court_cases").select("post_id, final_verdict").in("post_id", ids).eq("status", "decided");
        const decided = (agreed ?? []) as any[];
        const agreedCount = decided.filter((d) => d.final_verdict && d.final_verdict !== "no_verdict" && d.final_verdict !== "need_update").length;
        const pct = decided.length === 0 ? 0 : Math.round((agreedCount / decided.length) * 100);
        patternStat = { totalSimilar: ids.length, agreedPct: pct };
      }
      for (const s of ((similar ?? []) as any[]).slice(0, 3)) {
        similarCases.push({ postId: s.id, title: s.case_title ?? s.title ?? "Untitled case" });
      }
    }

    return {
      postId: post.id,
      caseTitle: post.case_title ?? post.title ?? "Untitled case",
      alias: aliasFromProfile(profile as any),
      storyText: post.story_text ?? "",
      questionBeforeCourt: post.question_before_court ?? "What does the court say?",
      createdAt: post.created_at ?? new Date().toISOString(),
      updatedAt: (outcome as any)?.created_at ?? post.updated_at ?? post.created_at ?? new Date().toISOString(),
      conflictType: (post.score_category as string | null) ?? null,
      totalVotes: v.total,
      dominantVerdict: v.topKind,
      dominantVerdictPct: v.total === 0 ? 0 : Math.round((v.topCount / v.total) * 100),
      dominantVerdictCount: v.topCount,
      verdictLockAt: (cc as any)?.verdict_lock_at ?? (cc as any)?.decided_at ?? null,
      benchVerdictLine: (cc as any)?.bench_verdict_line ?? null,
      topReactionKind: r.topKind,
      topReactionPct: r.total === 0 ? 0 : Math.round((r.topCount / r.total) * 100),
      majorityTheme: (aiSum as any)?.majority_theme ?? null,
      minorityTheme: (aiSum as any)?.minority_theme ?? null,
      outcomeType: (outcome as any)?.outcome_type ?? null,
      outcomeDetail: (outcome as any)?.detail ?? null,
      daysToOutcome: (outcome as any)?.days_elapsed ?? null,
      outcomeAt: (outcome as any)?.created_at ?? null,
      counselComments,
      commentCount: post.comment_count ?? 0,
      patternStat,
      similarCases,
    };
  });

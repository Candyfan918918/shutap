// Nomination engine — recomputes nomination_score per spec and triggers
// court entry when a live post crosses the live-pool p95 threshold.
// Server-only. Fire-and-forget from vote/relate/comment/perspective handlers.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Spec formula:
//   nomination_score = (weighted_vote_sum / hours_live)
//                    + controversy_score
//                    + (relate_count * 0.3)
//                    + (participant_count * 2.0)
//                    + (comment_count * 0.1)
//
// controversy_score = 1 - |dominant_pct - 0.5| * 2   (0..1, peaks at 50/50)

function controversy(counts: Record<string, number>, total: number): number {
  if (total <= 0) return 0;
  let top = 0;
  for (const k of Object.keys(counts)) {
    const v = counts[k] ?? 0;
    if (v > top) top = v;
  }
  const dominantPct = top / total;
  return 1 - Math.abs(dominantPct - 0.5) * 2;
}

export const recalcNomination = createServerFn({ method: "POST" })
  .inputValidator(z.object({ postId: z.string().uuid() }).parse)
  .handler(async ({ data }): Promise<{ score: number; nominated: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: post }, { data: votes }, { data: persps }] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select(
          "id, author_id, status, candidacy_paused, published_at, comment_count, relate_count",
        )
        .eq("id", data.postId)
        .maybeSingle(),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("kind, weight, quarantined")
        .eq("post_id", data.postId),
      supabaseAdmin
        .from("post_perspectives")
        .select("id, standing_status")
        .eq("post_id", data.postId),
    ]);

    if (!post || post.status !== "published" || post.candidacy_paused) {
      return { score: 0, nominated: false };
    }

    const cleanVotes = (votes ?? []).filter((v: any) => !v.quarantined);
    const weighted_vote_sum = cleanVotes.reduce(
      (a: number, v: any) => a + (Number(v.weight) || 0),
      0,
    );
    const counts: Record<string, number> = {};
    let total = 0;
    for (const v of cleanVotes as any[]) {
      counts[v.kind] = (counts[v.kind] ?? 0) + 1;
      total += 1;
    }
    const controversy_score = controversy(counts, total);

    const hours_live = Math.max(
      0.25,
      (Date.now() - new Date(post.published_at ?? Date.now()).getTime()) / 3_600_000,
    );

    const relate_count = (post as any).relate_count ?? 0;
    const comment_count = (post as any).comment_count ?? 0;
    const participant_count = (persps ?? []).filter(
      (p: any) => p.standing_status === "verified",
    ).length;

    const nomination_score =
      weighted_vote_sum / hours_live
      + controversy_score
      + relate_count * 0.3
      + participant_count * 2.0
      + comment_count * 0.1;

    await supabaseAdmin
      .from("posts")
      .update({
        nomination_score,
        weighted_vote_sum,
        controversy_score,
      })
      .eq("id", data.postId);

    // p95 threshold over live pool (cheap; ~ms on modest pools).
    const { data: pool } = await supabaseAdmin
      .from("posts")
      .select("nomination_score")
      .eq("status", "published")
      .eq("candidacy_paused", false);

    const scores = ((pool ?? []) as any[])
      .map((p) => Number(p.nomination_score) || 0)
      .sort((a, b) => a - b);
    const p95 =
      scores.length >= 20
        ? scores[Math.floor(scores.length * 0.95)]
        : Infinity;

    if (nomination_score <= p95) {
      return { score: nomination_score, nominated: false };
    }

    // Skip if a live court_cases row already exists for this post.
    const { data: existing } = await supabaseAdmin
      .from("court_cases")
      .select("id")
      .eq("post_id", data.postId)
      .in("status", ["nominated", "in_court", "judgment_pending", "legendary"])
      .maybeSingle();
    if (existing) return { score: nomination_score, nominated: false };

    // Enter at city tier by default; geography refinement is deferred.
    const opensAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const closesAt = new Date(Date.now() + 24 * 60 * 60_000 + 30 * 60_000).toISOString();
    const { data: cc } = await supabaseAdmin
      .from("court_cases")
      .insert({
        post_id: data.postId,
        scope: "world",
        region_code: "WORLD",
        region_label: "🌎 World",
        status: "nominated",
        engagement_score: Math.round(nomination_score * 10),
        opens_at: opensAt,
        closes_at: closesAt,
        current_tier: "city",
        verdict_lock_at: closesAt,
      } as any)
      .select("id")
      .maybeSingle();

    if (cc) {
      await supabaseAdmin.from("court_tiers").insert({
        case_id: (cc as any).id,
        tier: "city",
        started_at: new Date().toISOString(),
        vote_count: total,
      } as any);

      await supabaseAdmin.from("notifications").insert({
        user_id: (post as any).author_id,
        kind: "court_entered",
        payload: {
          case_id: (cc as any).id,
          post_id: data.postId,
          message: "Your case has been called to City Court.",
        },
      } as any);
    }

    return { score: nomination_score, nominated: true };
  });

// Fire-and-forget helper for engagement handlers.
export function bumpNomination(postId: string): void {
  void (async () => {
    try {
      await recalcNomination({ data: { postId } });
    } catch {
      /* never crash the originating action */
    }
  })();
}

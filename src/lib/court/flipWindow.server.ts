// Flip window — re-vote round opened when bothSidesHeard flips after a verdict.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FLIP_WINDOW_HOURS = 6;

/**
 * Open a flip-round on the active court case for a post.
 * No-op when the case isn't decided yet, is already in a flip round,
 * or has already been finalized as legendary.
 */
export async function openFlipWindowForPost(postId: string): Promise<void> {
  try {
    const { data: cases } = await supabaseAdmin
      .from("court_cases")
      .select(
        "id, status, final_verdict, is_flip_round, flip_window_closes_at, flip_round_count",
      )
      .eq("post_id", postId);

    if (!cases || cases.length === 0) return;

    const closesAt = new Date(Date.now() + FLIP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    for (const c of cases as any[]) {
      if (c.status !== "decided") continue;
      if (c.is_flip_round) continue;
      if (c.flip_round_count >= 2) continue;

      await supabaseAdmin
        .from("court_cases")
        .update({
          status: "in_court",
          is_flip_round: true,
          flip_window_opened_at: new Date().toISOString(),
          flip_window_closes_at: closesAt,
          closes_at: closesAt,
          verdict_lock_at: closesAt,
          pre_flip_verdict: c.final_verdict ?? null,
          flip_round_count: (c.flip_round_count ?? 0) + 1,
        })
        .eq("id", c.id);

      // Notify everyone who voted in the prior round.
      const { data: voters } = await supabaseAdmin
        .from("post_verdict_votes")
        .select("user_id, kind")
        .eq("post_id", postId);

      const seen = new Set<string>();
      const notifs: any[] = [];
      for (const v of (voters ?? []) as any[]) {
        if (!v.user_id || seen.has(v.user_id)) continue;
        seen.add(v.user_id);
        notifs.push({
          user_id: v.user_id,
          kind: "court_flip_opened",
          payload: {
            post_id: postId,
            case_id: c.id,
            prior_vote: v.kind,
            closes_at: closesAt,
            message: "New evidence dropped. Re-vote open for 6 hours.",
          },
        });
      }
      if (notifs.length > 0) {
        // Chunked insert to keep payload sane.
        for (let i = 0; i < notifs.length; i += 200) {
          await supabaseAdmin.from("notifications").insert(notifs.slice(i, i + 200));
        }
      }

      // Bump vote round counter — new votes from now belong to round+1.
      // Existing votes keep their original flip_round value.
    }
  } catch {
    // Flip-window failure must never break the perspective submission.
  }
}

// Community reputation: aggregates contribution signals (comments, verdicts,
// arc engagement, shares, saves, streak) for a user. Read-only; no schema
// changes — everything is derived from existing tables.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveReputationBadges,
  helpfulnessScore,
  reputationScore,
  type Badge,
  type ReputationStats,
} from "@/lib/badges";

export interface TopFunnyComment {
  id: string;
  body: string;
  postId: string;
  funnyCount: number;
  likeCount: number;
  createdAt: string;
}

export interface ReputationSummary {
  stats: ReputationStats;
  score: number;          // 0..9999 rolled-up reputation
  helpfulness: number;    // 0..100
  badges: Badge[];
  funniestComments: TopFunnyComment[];
}


export const getUserReputation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ReputationSummary> => {
    const uid = data.userId;

    const [
      commentsAgg,
      verdicts,
      updateReqs,
      arcs,
      shares,
      saves,
      streakRes,
      funny,
    ] = await Promise.all([
      supabaseAdmin
        .from("post_comments")
        .select("id, like_count, funny_count")
        .eq("user_id", uid)
        .eq("status", "published")
        .is("deleted_at", null),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("kind")
        .eq("user_id", uid),
      supabaseAdmin
        .from("post_update_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabaseAdmin
        .from("post_arc_follows")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabaseAdmin
        .from("post_shares")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabaseAdmin
        .from("saved_posts")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabaseAdmin
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("post_comments")
        .select("id, body, post_id, funny_count, like_count, created_at")
        .eq("user_id", uid)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("funny_count", { ascending: false })
        .order("like_count", { ascending: false })
        .limit(3),
    ]);


    const cRows = (commentsAgg.data ?? []) as Array<{ like_count: number; funny_count: number }>;
    const commentCount = cRows.length;
    const commentLikes = cRows.reduce((a, r) => a + (r.like_count ?? 0), 0);
    const commentFunny = cRows.reduce((a, r) => a + (r.funny_count ?? 0), 0);

    const vRows = (verdicts.data ?? []) as Array<{ kind: string }>;
    const verdictsCast = vRows.length;
    const redFlagVotesCast = vRows.filter((v) => v.kind === "red_flag" || v.kind === "run").length;
    const hopeVotesCast = vRows.filter((v) => v.kind === "green_flag" || v.kind === "talk_it_out").length;

    const streak = (streakRes.data as { current_streak: number; longest_streak: number } | null) ?? {
      current_streak: 0,
      longest_streak: 0,
    };

    const stats: ReputationStats = {
      commentCount,
      commentLikes,
      commentFunny,
      verdictsCast,
      redFlagVotesCast,
      hopeVotesCast,
      updateRequestsGiven: updateReqs.count ?? 0,
      arcsFollowed: arcs.count ?? 0,
      sharesGiven: shares.count ?? 0,
      savesGiven: saves.count ?? 0,
      currentStreak: streak.current_streak,
      longestStreak: streak.longest_streak,
    };


    const funniestComments: TopFunnyComment[] = ((funny.data ?? []) as Array<{
      id: string; body: string; post_id: string; funny_count: number; like_count: number; created_at: string;
    }>)
      .filter((r) => (r.funny_count ?? 0) > 0 || (r.like_count ?? 0) > 0)
      .map((r) => ({
        id: r.id,
        body: r.body,
        postId: r.post_id,
        funnyCount: r.funny_count ?? 0,
        likeCount: r.like_count ?? 0,
        createdAt: r.created_at,
      }));

    return {
      stats,
      score: reputationScore(stats),
      helpfulness: helpfulnessScore(stats),
      badges: deriveReputationBadges(stats),
      funniestComments,
    };
  });

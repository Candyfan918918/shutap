// Daily Relationship Court: featured case + streaks.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VERDICT_KINDS, type VerdictKind, type VerdictCounts } from "@/lib/posts/community.functions";

export interface DailyCase {
  caseDate: string;
  postId: string;
  headline: string;
  subheadline: string;
  aiSummary: string | null;
  post: {
    id: string;
    title: string;
    storyText: string;
    score: number | null;
    scoreCategory: string | null;
    mediaUrl: string | null;
    badges: string[];
    commentCount: number;
    likeCount: number;
    shareCount: number;
    saveCount: number;
  } | null;
  verdict: { counts: VerdictCounts; total: number };
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const FUNNY_LINES = [
  "The internet has spoken 😭",
  "The jury is shook.",
  "Verdict served warm.",
  "Court is officially in shambles.",
  "Receipts have entered the chat.",
];

function pickAiSummary(counts: VerdictCounts, total: number): string {
  if (total === 0) return "Court is empty… be the first juror.";
  const sorted = (Object.entries(counts) as Array<[VerdictKind, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "Court is empty… be the first juror.";
  const [topKind, topN] = sorted[0];
  const pct = Math.round((topN / total) * 100);
  const labels: Record<VerdictKind, string> = {
    red_flag: "🚩 Red Flag",
    green_flag: "💚 Green Flag",
    run: "🏃 Run",
    talk_it_out: "🗣 Talk It Out",
    lawyer_up: "⚖️ Lawyer Up",
    therapy_might_help: "🛋 Therapy Might Help",
    need_update: "👀 Need Update",
  };
  const line = FUNNY_LINES[total % FUNNY_LINES.length];
  return `${pct}% voted ${labels[topKind]}. ${line}`;
}

const emptyCounts = (): VerdictCounts =>
  VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);

export const getTodaysCase = createServerFn({ method: "GET" })
  .handler(async (): Promise<DailyCase | null> => {
    const today = todayUTC();
    const { data: row, error } = await supabaseAdmin.rpc("ensure_daily_case", { _date: today });
    if (error) throw new Error(error.message);
    const dc = (Array.isArray(row) ? row[0] : row) as
      | { case_date: string; post_id: string; headline: string | null; subheadline: string | null; ai_summary: string | null }
      | null;
    if (!dc) return null;

    const [{ data: post }, { data: vRows }] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("id, title, story_text, score, score_category, media_url, badges, comment_count, like_count, share_count, save_count, status, visibility, deleted_at")
        .eq("id", dc.post_id)
        .maybeSingle(),
      supabaseAdmin
        .from("post_verdict_counts")
        .select("kind, count")
        .eq("post_id", dc.post_id),
    ]);

    const counts = emptyCounts();
    let total = 0;
    for (const r of (vRows ?? []) as Array<{ kind: VerdictKind; count: number }>) {
      counts[r.kind] = r.count;
      total += r.count;
    }

    const aiSummary = dc.ai_summary ?? pickAiSummary(counts, total);

    return {
      caseDate: dc.case_date,
      postId: dc.post_id,
      headline: dc.headline ?? "⚖️ Daily Relationship Court™",
      subheadline: dc.subheadline ?? "Today's case… who's actually wrong here?",
      aiSummary,
      post:
        post && post.status === "published" && post.visibility === "public" && !post.deleted_at
          ? {
              id: post.id as string,
              title: post.title as string,
              storyText: post.story_text as string,
              score: (post.score as number | null) ?? null,
              scoreCategory: (post.score_category as string | null) ?? null,
              mediaUrl: (post.media_url as string | null) ?? null,
              badges: ((post.badges as string[] | null) ?? []),
              commentCount: (post.comment_count as number | null) ?? 0,
              likeCount: (post.like_count as number | null) ?? 0,
              shareCount: (post.share_count as number | null) ?? 0,
              saveCount: (post.save_count as number | null) ?? 0,
            }
          : null,
      verdict: { counts, total },
    };
  });

// ---------- Streaks ----------
export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  badge: { label: string; emoji: string } | null;
}

function streakBadge(current: number): StreakInfo["badge"] {
  if (current >= 30) return { label: "Relationship judge", emoji: "⚖️" };
  if (current >= 7) return { label: "Chaos scholar", emoji: "🎓" };
  if (current >= 3) return { label: "Tea streak", emoji: "☕" };
  if (current >= 1) return { label: "Day one juror", emoji: "🧑‍⚖️" };
  return null;
}

export const getMyStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StreakInfo> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("user_streaks")
      .select("current_streak, longest_streak, last_active_date")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (row?.current_streak as number | undefined) ?? 0;
    const longest = (row?.longest_streak as number | undefined) ?? 0;
    return {
      current,
      longest,
      lastActiveDate: (row?.last_active_date as string | null) ?? null,
      badge: streakBadge(current),
    };
  });

export const recordParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({}).parse(i ?? {}))
  .handler(async ({ context }): Promise<StreakInfo> => {
    const { userId } = context;
    const today = todayUTC();
    const { data, error } = await supabaseAdmin.rpc("bump_streak", {
      _user_id: userId,
      _today: today,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { current_streak: number; longest_streak: number; last_active_date: string | null }
      | null;
    const current = row?.current_streak ?? 1;
    return {
      current,
      longest: row?.longest_streak ?? current,
      lastActiveDate: row?.last_active_date ?? today,
      badge: streakBadge(current),
    };
  });

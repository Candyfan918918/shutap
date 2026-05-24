// Public trending feed for the landing page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface FeedItem {
  id: string;
  title: string;
  storyText: string;
  score: number | null;
  scoreCategory: string | null;
  badges: string[];
  mediaUrl: string | null;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  publishedAt: string | null;
  isSeed: boolean;
  author: { handle: string | null; nickname: string | null; avatarUrl: string | null } | null;
  trendScore: number;
}

export const listTrendingFeed = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        limit: z.number().min(1).max(60).default(24),
        category: z.string().max(40).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<FeedItem[]> => {
    let query = supabaseAdmin
      .from("posts")
      .select(
        "id, author_id, title, story_text, score, score_category, badges, media_url, view_count, like_count, share_count, comment_count, published_at, is_seed",
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(120);
    if (data.category) query = query.contains("badges", [data.category]);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string; author_id: string; title: string; story_text: string;
      score: number | null; score_category: string | null; badges: string[];
      media_url: string | null; view_count: number; like_count: number;
      share_count: number; comment_count: number;
      published_at: string | null; is_seed: boolean;
    }>;
    if (list.length === 0) return [];

    const authorIds = Array.from(new Set(list.map((p) => p.author_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, nickname, avatar_url")
      .in("id", authorIds);
    const byAuthor = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        p as { id: string; handle: string | null; nickname: string | null; avatar_url: string | null },
      ]),
    );

    const now = Date.now();
    const HOUR = 1000 * 60 * 60;
    const scored = list.map((p) => {
      const ageHrs = p.published_at ? Math.max(1, (now - new Date(p.published_at).getTime()) / HOUR) : 9999;
      const engagement =
        p.like_count * 2 + p.comment_count * 3 + p.share_count * 5 + Math.log10(Math.max(p.view_count, 1));
      // Hacker-news-ish gravity; seed posts are slightly down-weighted so real posts win.
      const trendScore = (engagement + 1) / Math.pow(ageHrs + 2, 1.5) * (p.is_seed ? 0.6 : 1);
      const a = byAuthor.get(p.author_id);
      return {
        id: p.id,
        title: p.title,
        storyText: p.story_text,
        score: p.score,
        scoreCategory: p.score_category,
        badges: p.badges,
        mediaUrl: p.media_url,
        viewCount: p.view_count,
        likeCount: p.like_count,
        shareCount: p.share_count,
        commentCount: p.comment_count,
        publishedAt: p.published_at,
        isSeed: p.is_seed,
        author: a ? { handle: a.handle, nickname: a.nickname, avatarUrl: a.avatar_url } : null,
        trendScore,
      } satisfies FeedItem;
    });

    scored.sort((a, b) => b.trendScore - a.trendScore);
    return scored.slice(0, data.limit);
  });

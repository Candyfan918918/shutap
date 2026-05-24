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
  saveCount: number;
  verdictCount: number;
  publishedAt: string | null;
  isSeed: boolean;
  funnyLabel: string;
  cityLabel: string | null;
  countryCode: string | null;
  author: { handle: string | null; nickname: string | null; avatarUrl: string | null } | null;
  trendScore: number;
}

// Category → badge token list (any-match via array overlap).
export const FEED_CATEGORIES = [
  "trending",
  "latest",
  "chaos",
  "wholesome",
  "family",
  "situationship",
  "marriage",
  "plot_twist",
] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

const CATEGORY_BADGES: Partial<Record<FeedCategory, string[]>> = {
  chaos: ["Netflix Original™", "Prestige Drama™", "💔 Cheating", "💀 Chaos"],
  wholesome: ["Sweet™", "🥹 Healing", "Indie Romcom™", "Indie Romcom Energy", "Sweet™ Chaos"],
  family: ["👵 MIL", "Mother-in-law", "👨‍👩‍👧"],
  situationship: ["🤡 Plot Twist", "Sitcom Energy™", "😶 Daily"],
  marriage: ["Still Somehow Married™", "💍", "Dishwasher Wars Survivor"],
  plot_twist: ["🤡 Plot Twist", "Plot Twist Royalty 👑"],
};

function pickFunnyLabel(badges: string[], score: number | null, scoreCategory: string | null): string {
  const hay = `${(badges ?? []).join(" ")} ${scoreCategory ?? ""}`.toLowerCase();
  if (hay.includes("mil") || hay.includes("mother")) return "Mother-in-law final boss";
  if (hay.includes("cheat")) return "Girl WHAT 😭";
  if (hay.includes("netflix") || (score ?? 0) >= 800) return "Netflix-level drama";
  if (hay.includes("prestige") || (score ?? 0) >= 600) return "Prestige drama unlocked";
  if (hay.includes("sweet") || hay.includes("healing") || hay.includes("indie romcom"))
    return "Unexpectedly wholesome";
  if (hay.includes("plot twist")) return "Plot twist incoming 🍿";
  if (hay.includes("sitcom")) return "Sitcom energy 📺";
  if (hay.includes("money") || hay.includes("debt")) return "Wallet says ouch 💸";
  if ((score ?? 0) <= 200) return "Soft launch, soft landing 🌱";
  return "Tea is hot ☕";
}

export const listTrendingFeed = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        limit: z.number().min(1).max(60).default(24),
        sort: z.enum(["trending", "latest"]).default("trending"),
        category: z.enum(FEED_CATEGORIES).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<FeedItem[]> => {
    let query = supabaseAdmin
      .from("posts")
      .select(
        "id, author_id, title, story_text, score, score_category, badges, media_url, view_count, like_count, share_count, comment_count, save_count, published_at, is_seed",
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(data.sort === "latest" ? data.limit : 120);

    const badgeFilter = data.category ? CATEGORY_BADGES[data.category] : undefined;
    if (badgeFilter && badgeFilter.length > 0) {
      query = query.overlaps("badges", badgeFilter);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string; author_id: string; title: string; story_text: string;
      score: number | null; score_category: string | null; badges: string[];
      media_url: string | null; view_count: number; like_count: number;
      share_count: number; comment_count: number; save_count: number;
      published_at: string | null; is_seed: boolean;
    }>;
    if (list.length === 0) return [];

    const postIds = list.map((p) => p.id);
    const authorIds = Array.from(new Set(list.map((p) => p.author_id)));

    const [profilesRes, verdictsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, handle, nickname, avatar_url, city_label, country_code, anonymous_mode")
        .in("id", authorIds),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("post_id")
        .in("post_id", postIds),
    ]);

    const byAuthor = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id as string,
        p as {
          id: string; handle: string | null; nickname: string | null; avatar_url: string | null;
          city_label: string | null; country_code: string | null; anonymous_mode: boolean | null;
        },
      ]),
    );
    const verdictCounts = new Map<string, number>();
    for (const v of (verdictsRes.data ?? []) as Array<{ post_id: string }>) {
      verdictCounts.set(v.post_id, (verdictCounts.get(v.post_id) ?? 0) + 1);
    }

    const now = Date.now();
    const HOUR = 1000 * 60 * 60;
    const scored = list.map((p) => {
      const ageHrs = p.published_at ? Math.max(1, (now - new Date(p.published_at).getTime()) / HOUR) : 9999;
      const engagement =
        p.like_count * 2 +
        p.comment_count * 3 +
        p.share_count * 5 +
        p.save_count * 4 +
        (verdictCounts.get(p.id) ?? 0) * 3 +
        Math.log10(Math.max(p.view_count, 1));
      const trendScore = (engagement + 1) / Math.pow(ageHrs + 2, 1.5) * (p.is_seed ? 0.6 : 1);
      const a = byAuthor.get(p.author_id);
      const showCity = a && a.anonymous_mode !== true;
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
        saveCount: p.save_count,
        verdictCount: verdictCounts.get(p.id) ?? 0,
        publishedAt: p.published_at,
        isSeed: p.is_seed,
        funnyLabel: pickFunnyLabel(p.badges, p.score, p.score_category),
        cityLabel: showCity ? a?.city_label ?? null : null,
        countryCode: a?.country_code ?? null,
        author: a ? { handle: a.handle, nickname: a.nickname, avatarUrl: a.avatar_url } : null,
        trendScore,
      } satisfies FeedItem;
    });

    if (data.sort === "trending") {
      scored.sort((a, b) => b.trendScore - a.trendScore);
    }
    // "latest" already ordered by published_at desc in the query.
    return scored.slice(0, data.limit);
  });

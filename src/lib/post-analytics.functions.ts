// Per-post KPI + daily timeseries + share breakdown.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PostKpis {
  postId: string;
  title: string;
  story_text: string;
  score: number | null;
  score_category: string | null;
  media_url: string | null;
  visibility: "public" | "private" | "friends";
  status: "draft" | "published";
  published_at: string | null;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  forwards: number;
  comments: number;
  dailyViews: Array<{ day: string; count: number }>;
  shareBreakdown: Array<{ platform: string; count: number }>;
  forwardBreakdown: Array<{ channel: string; count: number }>;
}

export const getPostAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PostKpis> => {
    const { userId } = context;
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("id, author_id, title, story_text, score, score_category, media_url, visibility, status, published_at, view_count, like_count, share_count, save_count, forward_count, story_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post || post.author_id !== userId) throw new Error("not found");

    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [views30, shares, forwards, commentsCount] = await Promise.all([
      supabaseAdmin
        .from("post_views")
        .select("viewed_at")
        .eq("post_id", data.postId)
        .gte("viewed_at", sinceIso),
      supabaseAdmin.from("post_shares").select("platform").eq("post_id", data.postId),
      supabaseAdmin.from("post_forwards").select("channel").eq("post_id", data.postId),
      (post.story_id
        ? supabaseAdmin.from("comments").select("id", { head: true, count: "exact" }).eq("story_id", post.story_id as string).eq("status", "published")
        : Promise.resolve({ count: 0 })),
    ]);

    // Bucket views by day (UTC)
    const dayMap = new Map<string, number>();
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const v of (views30.data ?? []) as Array<{ viewed_at: string }>) {
      const k = v.viewed_at.slice(0, 10);
      if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
    }
    const dailyViews = Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));

    const tally = <T extends { [k: string]: unknown }>(rows: T[], key: keyof T) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = String(r[key] ?? "");
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries()).map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count);
    };

    return {
      postId: post.id as string,
      title: post.title as string,
      story_text: post.story_text as string,
      score: (post.score as number | null) ?? null,
      score_category: (post.score_category as string | null) ?? null,
      media_url: (post.media_url as string | null) ?? null,
      visibility: (post.visibility as PostKpis["visibility"]) ?? "public",
      status: (post.status as PostKpis["status"]) ?? "draft",
      published_at: (post.published_at as string | null) ?? null,
      views: (post.view_count as number) ?? 0,
      likes: (post.like_count as number) ?? 0,
      shares: (post.share_count as number) ?? 0,
      saves: (post.save_count as number) ?? 0,
      forwards: (post.forward_count as number) ?? 0,
      comments: commentsCount.count ?? 0,
      dailyViews,
      shareBreakdown: tally((shares.data ?? []) as Array<{ platform: string }>, "platform").map((x) => ({ platform: x.k, count: x.count })),
      forwardBreakdown: tally((forwards.data ?? []) as Array<{ channel: string }>, "channel").map((x) => ({ channel: x.k, count: x.count })),
    };
  });

// ---------- Public: record a view (deduped per session 24h) ----------
export const recordPostView = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ postId: z.string().uuid(), sessionId: z.string().min(8).max(120), viewerId: z.string().uuid().nullable().optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("increment_post_view", {
      _post_id: data.postId,
      _session_hash: data.sessionId,
      _viewer_id: (data.viewerId ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

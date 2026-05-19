// Post management: list mine, change visibility, soft delete, edit, forward.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MyPostRow {
  id: string;
  title: string;
  story_text: string;
  status: "draft" | "published";
  visibility: "public" | "private" | "friends";
  score: number | null;
  score_category: string | null;
  media_url: string | null;
  tone: string;
  view_count: number;
  like_count: number;
  share_count: number;
  save_count: number;
  forward_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const listMyPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        tab: z.enum(["published", "drafts", "private"]).default("published"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<MyPostRow[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("posts")
      .select(
        "id, title, story_text, status, visibility, score, score_category, media_url, tone, view_count, like_count, share_count, save_count, forward_count, published_at, created_at, updated_at",
      )
      .eq("author_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (data.tab === "published") q = q.eq("status", "published").eq("visibility", "public");
    else if (data.tab === "drafts") q = q.eq("status", "draft");
    else if (data.tab === "private")
      q = q.eq("status", "published").in("visibility", ["private", "friends"]);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as MyPostRow[];
  });

export const getMyPostCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [p, d, pr] = await Promise.all([
      supabase.from("posts").select("id", { head: true, count: "exact" }).eq("author_id", userId).eq("status", "published").eq("visibility", "public").is("deleted_at", null),
      supabase.from("posts").select("id", { head: true, count: "exact" }).eq("author_id", userId).eq("status", "draft").is("deleted_at", null),
      supabase.from("posts").select("id", { head: true, count: "exact" }).eq("author_id", userId).eq("status", "published").in("visibility", ["private", "friends"]).is("deleted_at", null),
    ]);
    return {
      published: p.count ?? 0,
      drafts: d.count ?? 0,
      private: pr.count ?? 0,
    };
  });

export const setPostVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        visibility: z.enum(["public", "private", "friends"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("posts")
      .update({ visibility: data.visibility } as never)
      .eq("id", data.postId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString(), visibility: "public" } as never)
      .eq("id", data.postId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Keep it published but flip visibility to private (preserves analytics)
    const { error } = await supabase
      .from("posts")
      .update({ visibility: "private" } as never)
      .eq("id", data.postId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const softDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", data.postId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        title: z.string().min(2).max(160).optional(),
        storyText: z.string().min(10).max(2000).optional(),
        mediaUrl: z.string().url().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.storyText !== undefined) patch.story_text = data.storyText;
    if (data.mediaUrl !== undefined) patch.media_url = data.mediaUrl;
    const { error } = await supabase
      .from("posts")
      .update(patch as never)
      .eq("id", data.postId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Public-facing posts for a profile ----------
export interface PublicPostRow {
  id: string;
  title: string;
  story_text: string;
  score: number | null;
  score_category: string | null;
  media_url: string | null;
  view_count: number;
  like_count: number;
  share_count: number;
  published_at: string | null;
}

export const listAuthorPublicPosts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ authorId: z.string().uuid(), viewerId: z.string().uuid().nullable().optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<PublicPostRow[]> => {
    let visibilityFilter = ["public"];
    if (data.viewerId && data.viewerId === data.authorId) {
      visibilityFilter = ["public", "friends", "private"];
    } else if (data.viewerId) {
      const { data: friend } = await supabaseAdmin.rpc("is_friend", {
        _a: data.viewerId,
        _b: data.authorId,
      });
      if (friend === true) visibilityFilter = ["public", "friends"];
    }
    const { data: rows, error } = await supabaseAdmin
      .from("posts")
      .select("id, title, story_text, score, score_category, media_url, view_count, like_count, share_count, published_at")
      .eq("author_id", data.authorId)
      .eq("status", "published")
      .in("visibility", visibilityFilter)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PublicPostRow[];
  });

// ---------- Chaos history ----------
export interface ChaosHistoryRow {
  scanId: string;
  score: number;
  category: string | null;
  completedAt: string;
  postId: string | null;
}

export const getChaosHistory = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<ChaosHistoryRow[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("scan_results")
      .select("id, score, category, completed_at, post_id")
      .eq("user_id", data.userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      scanId: r.id as string,
      score: (r.score as number | null) ?? 0,
      category: (r.category as string | null) ?? null,
      completedAt: (r.completed_at as string | null) ?? "",
      postId: (r.post_id as string | null) ?? null,
    }));
  });

// ---------- Record forward ----------
export const recordForward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        channel: z.enum(["x", "tiktok", "instagram", "xiaohongshu", "facebook", "imessage", "whatsapp", "copy_link", "friend"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_forwards")
      .insert({ post_id: data.postId, sender_id: userId, channel: data.channel } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

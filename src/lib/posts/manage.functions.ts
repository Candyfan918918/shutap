// Author-only post management: list mine, change visibility, publish, soft delete, edit.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

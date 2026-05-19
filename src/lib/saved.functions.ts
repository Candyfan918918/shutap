// Saved posts (bookmarks).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const toggleSavePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ saved: boolean }> => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId)
      .eq("post_id", data.postId)
      .maybeSingle();
    if (existing) {
      await supabase.from("saved_posts").delete().eq("user_id", userId).eq("post_id", data.postId);
      return { saved: false };
    }
    const { error } = await supabase
      .from("saved_posts")
      .insert({ user_id: userId, post_id: data.postId } as never);
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export interface SavedPostRow {
  id: string;
  title: string;
  story_text: string;
  score: number | null;
  score_category: string | null;
  media_url: string | null;
  author_id: string;
  author_handle: string;
  author_display_name: string;
  saved_at: string;
}

export const listSavedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<SavedPostRow[]> => {
    const targetId = data.userId ?? context.userId;
    if (targetId !== context.userId) return []; // saved is private
    const { data: rows, error } = await supabaseAdmin
      .from("saved_posts")
      .select("post_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.post_id as string);
    if (!ids.length) return [];
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, title, story_text, score, score_category, media_url, author_id")
      .in("id", ids)
      .is("deleted_at", null);
    const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id as string)));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, nickname")
      .in("id", authorIds);
    const byAuth = new Map((profs ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
    const bySavedAt = new Map((rows ?? []).map((r) => [r.post_id as string, r.created_at as string]));
    return (posts ?? []).map((p) => {
      const a = byAuth.get(p.author_id as string);
      return {
        id: p.id as string,
        title: p.title as string,
        story_text: p.story_text as string,
        score: (p.score as number | null) ?? null,
        score_category: (p.score_category as string | null) ?? null,
        media_url: (p.media_url as string | null) ?? null,
        author_id: p.author_id as string,
        author_handle: ((a?.handle as string | undefined) ?? "user"),
        author_display_name: ((a?.display_name as string | undefined) ?? (a?.nickname as string | undefined) ?? "user"),
        saved_at: bySavedAt.get(p.id as string) ?? "",
      };
    });
  });

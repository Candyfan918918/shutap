// Story arcs: episodic updates, follow + request-update mechanic.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const UPDATE_KINDS = [
  "part",
  "time_jump",
  "broke_up",
  "got_married",
  "got_worse",
  "got_better",
  "final",
] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export interface PostUpdate {
  id: string;
  postId: string;
  authorId: string;
  kind: UpdateKind;
  title: string | null;
  body: string;
  mediaUrl: string | null;
  episodeNumber: number;
  createdAt: string;
}

export interface ArcStatus {
  requestCount: number;
  updateCount: number;
  iRequested: boolean;
  iFollow: boolean;
  isAuthor: boolean;
}

// ---------- public: list updates for a post ----------
async function resolveViewerIdForArcs(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    const { createClient } = await import("@supabase/supabase-js");
    const c = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await c.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export const listPostUpdates = createServerFn({ method: "GET" })
  .inputValidator((d: { postId: string }) =>
    z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // Visibility gate: don't leak arc bodies on non-public posts.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("visibility, author_id, status, deleted_at")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || (post as { status: string }).status !== "published" || (post as { deleted_at: string | null }).deleted_at) {
      return { updates: [] as PostUpdate[] };
    }
    const visibility = (post as { visibility: string }).visibility;
    const authorId = (post as { author_id: string }).author_id;
    if (visibility !== "public") {
      const viewerId = await resolveViewerIdForArcs();
      if (!viewerId) return { updates: [] as PostUpdate[] };
      if (viewerId !== authorId) {
        if (visibility === "friends") {
          const { data: friend } = await supabaseAdmin.rpc("is_friend", { _a: viewerId, _b: authorId });
          if (friend !== true) return { updates: [] as PostUpdate[] };
        } else {
          return { updates: [] as PostUpdate[] };
        }
      }
    }

    const { data: rows, error } = await supabaseAdmin
      .from("post_updates")
      .select("id, post_id, author_id, kind, title, body, media_url, episode_number, created_at")
      .eq("post_id", data.postId)
      .is("deleted_at", null)
      .eq("status", "published")
      .order("episode_number", { ascending: true });
    if (error) throw new Error(error.message);
    const updates: PostUpdate[] = (rows ?? []).map((r) => ({
      id: r.id,
      postId: r.post_id,
      authorId: r.author_id,
      kind: r.kind as UpdateKind,
      title: r.title,
      body: r.body,
      mediaUrl: r.media_url,
      episodeNumber: r.episode_number,
      createdAt: r.created_at,
    }));
    return { updates };
  });

// ---------- public: arc status (counts + viewer flags) ----------
export const getArcStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { postId: string }) =>
    z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: post, error: pErr } = await supabaseAdmin
      .from("posts")
      .select("author_id, update_request_count, update_count")
      .eq("id", data.postId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!post) throw new Error("Post not found");

    // viewer (optional)
    let viewerId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { createClient } = await import("@supabase/supabase-js");
        const c = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: auth } } },
        );
        const { data: u } = await c.auth.getUser();
        viewerId = u.user?.id ?? null;
      }
    } catch { /* ignore */ }

    let iRequested = false;
    let iFollow = false;
    if (viewerId) {
      const [{ data: r }, { data: f }] = await Promise.all([
        supabaseAdmin
          .from("post_update_requests")
          .select("user_id")
          .eq("post_id", data.postId)
          .eq("user_id", viewerId)
          .maybeSingle(),
        supabaseAdmin
          .from("post_arc_follows")
          .select("user_id")
          .eq("post_id", data.postId)
          .eq("user_id", viewerId)
          .maybeSingle(),
      ]);
      iRequested = !!r;
      iFollow = !!f;
    }

    const status: ArcStatus = {
      requestCount: post.update_request_count ?? 0,
      updateCount: post.update_count ?? 0,
      iRequested,
      iFollow,
      isAuthor: viewerId === post.author_id,
    };
    return status;
  });

// ---------- toggle: request an update ----------
export const toggleUpdateRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) =>
    z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_update_requests")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("post_update_requests")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { requested: false };
    }
    const { error } = await supabase
      .from("post_update_requests")
      .insert({ post_id: data.postId, user_id: userId });
    if (error) throw new Error(error.message);
    return { requested: true };
  });

// ---------- toggle: follow story arc ----------
export const toggleArcFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) =>
    z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_arc_follows")
      .select("user_id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("post_arc_follows")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { following: false };
    }
    const { error } = await supabase
      .from("post_arc_follows")
      .insert({ post_id: data.postId, user_id: userId });
    if (error) throw new Error(error.message);
    return { following: true };
  });

// ---------- author: post an update ----------
export const postUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    postId: string;
    kind: UpdateKind;
    title?: string | null;
    body: string;
    mediaUrl?: string | null;
  }) =>
    z.object({
      postId: z.string().uuid(),
      kind: z.enum(UPDATE_KINDS),
      title: z.string().trim().max(140).nullable().optional(),
      body: z.string().trim().min(2).max(4000),
      mediaUrl: z.string().url().max(2000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ensure author owns the post
    const { data: post, error: pErr } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!post || post.author_id !== userId) throw new Error("Only the author can post updates");

    const { data: row, error } = await supabase
      .from("post_updates")
      .insert({
        post_id: data.postId,
        author_id: userId,
        kind: data.kind,
        title: data.title ?? null,
        body: data.body,
        media_url: data.mediaUrl ?? null,
      })
      .select("id, episode_number")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, episodeNumber: row.episode_number };
  });

// ---------- author: delete an update ----------
export const deletePostUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { updateId: string }) =>
    z.object({ updateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_updates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.updateId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

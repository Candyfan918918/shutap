// Community: comments + verdict votes on published posts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Types ----------
export const VERDICT_KINDS = [
  "red_flag",
  "green_flag",
  "run",
  "talk_it_out",
  "lawyer_up",
  "therapy_might_help",
  "need_update",
] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];

export interface CommentRow {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: { handle: string | null; nickname: string | null; avatarUrl: string | null } | null;
}

export type VerdictCounts = Record<VerdictKind, number>;
const emptyVerdictCounts = (): VerdictCounts =>
  VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);

// ---------- listComments (public) ----------
export const listComments = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ postId: z.string().uuid(), limit: z.number().min(1).max(100).default(50) }).parse(i),
  )
  .handler(async ({ data }): Promise<CommentRow[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("post_comments")
      .select("id, post_id, user_id, parent_id, body, created_at")
      .eq("post_id", data.postId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string; post_id: string; user_id: string; parent_id: string | null;
      body: string; created_at: string;
    }>;
    if (list.length === 0) return [];
    const userIds = Array.from(new Set(list.map((c) => c.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, nickname, avatar_url")
      .in("id", userIds);
    const byId = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as { id: string; handle: string | null; nickname: string | null; avatar_url: string | null }]),
    );
    return list.map((c) => {
      const p = byId.get(c.user_id);
      return {
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        parentId: c.parent_id,
        body: c.body,
        createdAt: c.created_at,
        author: p ? { handle: p.handle, nickname: p.nickname, avatarUrl: p.avatar_url } : null,
      };
    });
  });

// ---------- addComment (auth) ----------
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: data.postId,
        user_id: userId,
        parent_id: data.parentId ?? null,
        body: data.body,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, createdAt: row.created_at as string };
  });

// ---------- deleteComment (auth, owner only) ----------
export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ commentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_comments")
      .update({ deleted_at: new Date().toISOString(), status: "removed" })
      .eq("id", data.commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- getVerdictCounts (public) ----------
export const getVerdictCounts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{ counts: VerdictCounts; total: number }> => {
    const counts = emptyVerdictCounts();
    const { data: rows } = await supabaseAdmin
      .from("post_verdict_counts")
      .select("kind, count")
      .eq("post_id", data.postId);
    let total = 0;
    for (const r of (rows ?? []) as Array<{ kind: VerdictKind; count: number }>) {
      counts[r.kind] = r.count;
      total += r.count;
    }
    return { counts, total };
  });

// ---------- getMyVerdict (auth) ----------
export const getMyVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ kind: VerdictKind | null }> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("post_verdict_votes")
      .select("kind")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();
    return { kind: (row?.kind as VerdictKind | undefined) ?? null };
  });

// ---------- castVerdict (auth) ----------
export const castVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ postId: z.string().uuid(), kind: z.enum(VERDICT_KINDS) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_verdict_votes")
      .upsert(
        { post_id: data.postId, user_id: userId, kind: data.kind },
        { onConflict: "post_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- removeVerdict (auth) ----------
export const removeVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_verdict_votes")
      .delete()
      .eq("post_id", data.postId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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

export const COMMENT_REACTION_KINDS = ["like", "funny", "changed_mind", "same_situation"] as const;
export type CommentReactionKind = (typeof COMMENT_REACTION_KINDS)[number];

export const COMMENT_SORTS = ["top", "newest", "funniest"] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

export interface CommentRow {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
  funnyCount: number;
  changedMindsCount: number;
  isSameSituation: boolean;
  isCounselPick: boolean;
  myReactions: CommentReactionKind[];
  author: { handle: string | null; nickname: string | null; avatarUrl: string | null } | null;
}

export type VerdictCounts = Record<VerdictKind, number>;
const emptyVerdictCounts = (): VerdictCounts =>
  VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);

// ---------- listComments (public; viewer-aware via bearer) ----------
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

async function resolveViewerId(): Promise<string | null> {
  try {
    const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const c = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await c.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        sort: z.enum(COMMENT_SORTS).default("top"),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<CommentRow[]> => {
    // Visibility gate: never expose comments on posts the viewer can't access.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("visibility, author_id, status, deleted_at")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || (post as { status: string }).status !== "published" || (post as { deleted_at: string | null }).deleted_at) {
      return [];
    }
    const visibility = (post as { visibility: string }).visibility;
    const authorId = (post as { author_id: string }).author_id;
    const earlyViewerId = await resolveViewerId();
    if (visibility !== "public") {
      if (!earlyViewerId) return [];
      if (earlyViewerId !== authorId) {
        if (visibility === "friends") {
          const { data: friend } = await supabaseAdmin.rpc("is_friend", { _a: earlyViewerId, _b: authorId });
          if (friend !== true) return [];
        } else {
          return [];
        }
      }
    }

    let q = supabaseAdmin
      .from("post_comments")
      .select("id, post_id, user_id, parent_id, body, created_at, like_count, funny_count, changed_minds_count, is_same_situation, is_counsel_pick")
      .eq("post_id", data.postId)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(data.limit);
    if (data.sort === "newest") {
      q = q.order("created_at", { ascending: false });
    } else if (data.sort === "funniest") {
      q = q.order("funny_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      q = q
        .order("is_counsel_pick", { ascending: false })
        .order("changed_minds_count", { ascending: false })
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false });
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string; post_id: string; user_id: string; parent_id: string | null;
      body: string; created_at: string; like_count: number; funny_count: number;
      changed_minds_count: number | null; is_same_situation: boolean | null; is_counsel_pick: boolean | null;
    }>;
    if (list.length === 0) return [];

    const userIds = Array.from(new Set(list.map((c) => c.user_id)));
    const commentIds = list.map((c) => c.id);
    const viewerId = await resolveViewerId();

    const [{ data: profiles }, { data: myReacts }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, handle, nickname, avatar_url")
        .in("id", userIds),
      viewerId
        ? supabaseAdmin
            .from("post_comment_reactions")
            .select("comment_id, kind")
            .eq("user_id", viewerId)
            .in("comment_id", commentIds)
        : Promise.resolve({ data: [] as Array<{ comment_id: string; kind: CommentReactionKind }> }),
    ]);

    const byUser = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as { id: string; handle: string | null; nickname: string | null; avatar_url: string | null }]),
    );
    const mine = new Map<string, CommentReactionKind[]>();
    for (const r of (myReacts ?? []) as Array<{ comment_id: string; kind: CommentReactionKind }>) {
      const arr = mine.get(r.comment_id) ?? [];
      arr.push(r.kind);
      mine.set(r.comment_id, arr);
    }

    return list.map((c) => {
      const p = byUser.get(c.user_id);
      return {
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        parentId: c.parent_id,
        body: c.body,
        createdAt: c.created_at,
        likeCount: c.like_count ?? 0,
        funnyCount: c.funny_count ?? 0,
        changedMindsCount: c.changed_minds_count ?? 0,
        isSameSituation: !!c.is_same_situation,
        isCounselPick: !!c.is_counsel_pick,
        myReactions: mine.get(c.id) ?? [],
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
    void (async () => {
      try {
        const { bumpNomination } = await import("@/lib/nomination.functions");
        bumpNomination(data.postId);
      } catch { /* ignore */ }
    })();
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

// ---------- toggleCommentReaction (auth) ----------
export const toggleCommentReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      kind: z.enum(COMMENT_REACTION_KINDS),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ active: boolean }> => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_comment_reactions")
      .select("id")
      .eq("comment_id", data.commentId)
      .eq("user_id", userId)
      .eq("kind", data.kind)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("post_comment_reactions")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { active: false };
    }
    const { error } = await supabase
      .from("post_comment_reactions")
      .insert({ comment_id: data.commentId, user_id: userId, kind: data.kind });
    if (error) throw new Error(error.message);
    return { active: true };
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
    z
      .object({
        postId: z.string().uuid(),
        kind: z.enum(VERDICT_KINDS),
        read_depth_percent: z.number().int().min(0).max(100).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      post_id: data.postId,
      user_id: userId,
      kind: data.kind,
      ...(typeof data.read_depth_percent === "number"
        ? { read_depth_percent: data.read_depth_percent }
        : {}),
    };
    const { error } = await supabase
      .from("post_verdict_votes")
      .upsert(row, { onConflict: "post_id,user_id" });
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

// ---------- getRelatedPosts (public) ----------
export interface RelatedPost {
  id: string;
  title: string;
  scoreCategory: string | null;
  score: number | null;
  badges: string[];
  mediaUrl: string | null;
  commentCount: number;
}

export const getRelatedPosts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ postId: z.string().uuid(), limit: z.number().min(1).max(12).default(4) }).parse(i),
  )
  .handler(async ({ data }): Promise<RelatedPost[]> => {
    const { data: cur } = await supabaseAdmin
      .from("posts")
      .select("score_category, badges")
      .eq("id", data.postId)
      .maybeSingle();
    const cat = (cur?.score_category as string | null) ?? null;
    const badges = (cur?.badges as string[] | null) ?? [];

    let q = supabaseAdmin
      .from("posts")
      .select("id, title, score_category, score, badges, media_url, comment_count")
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .neq("id", data.postId)
      .order("comment_count", { ascending: false })
      .limit(data.limit * 3);
    if (cat) q = q.eq("score_category", cat);
    const { data: rows } = await q;
    let pool = (rows ?? []) as Array<{
      id: string; title: string; score_category: string | null; score: number | null;
      badges: string[] | null; media_url: string | null; comment_count: number | null;
    }>;

    if (pool.length < data.limit) {
      const { data: extra } = await supabaseAdmin
        .from("posts")
        .select("id, title, score_category, score, badges, media_url, comment_count")
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .neq("id", data.postId)
        .order("created_at", { ascending: false })
        .limit(data.limit * 2);
      const seen = new Set(pool.map((p) => p.id));
      for (const r of (extra ?? []) as typeof pool) {
        if (!seen.has(r.id)) pool.push(r);
      }
    }

    // light badge-overlap boost
    const badgeSet = new Set(badges);
    pool = pool
      .map((p) => ({
        p,
        bonus: (p.badges ?? []).filter((b) => badgeSet.has(b)).length,
      }))
      .sort((a, b) => b.bonus - a.bonus)
      .map((x) => x.p)
      .slice(0, data.limit);

    return pool.map((p) => ({
      id: p.id,
      title: p.title,
      scoreCategory: p.score_category,
      score: p.score,
      badges: p.badges ?? [],
      mediaUrl: p.media_url,
      commentCount: p.comment_count ?? 0,
    }));
  });

// ---------- toggleChangedMind (auth) — bumps changed_minds_count ----------
export const toggleChangedMind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ commentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ active: boolean }> => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_comment_reactions")
      .select("id")
      .eq("comment_id", data.commentId)
      .eq("user_id", userId)
      .eq("kind", "changed_mind")
      .maybeSingle();
    if (existing) {
      await supabase.from("post_comment_reactions").delete().eq("id", existing.id);
      const { data: cur } = await supabaseAdmin
        .from("post_comments").select("changed_minds_count").eq("id", data.commentId).maybeSingle();
      const next = Math.max(0, ((cur as { changed_minds_count: number } | null)?.changed_minds_count ?? 0) - 1);
      await supabaseAdmin.from("post_comments").update({ changed_minds_count: next }).eq("id", data.commentId);
      return { active: false };
    }
    const { error } = await supabase
      .from("post_comment_reactions")
      .insert({ comment_id: data.commentId, user_id: userId, kind: "changed_mind" });
    if (error) throw new Error(error.message);
    const { data: cur } = await supabaseAdmin
      .from("post_comments").select("changed_minds_count").eq("id", data.commentId).maybeSingle();
    const next = ((cur as { changed_minds_count: number } | null)?.changed_minds_count ?? 0) + 1;
    await supabaseAdmin.from("post_comments").update({ changed_minds_count: next }).eq("id", data.commentId);
    return { active: true };
  });

// ---------- toggleSameSituation (auth) — flips is_same_situation on comment ----------
// Only the comment author may flag their own comment as "same situation".
export const toggleSameSituation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ commentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ active: boolean }> => {
    const { supabase, userId } = context;
    const { data: c } = await supabase
      .from("post_comments")
      .select("id, user_id, is_same_situation")
      .eq("id", data.commentId)
      .maybeSingle();
    if (!c) throw new Error("Comment not found.");
    if ((c as { user_id: string }).user_id !== userId) {
      throw new Error("Only the comment author can flag this.");
    }
    const next = !(c as { is_same_situation: boolean }).is_same_situation;
    const { error } = await supabase
      .from("post_comments")
      .update({ is_same_situation: next })
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { active: next };
  });

// ---------- markCounselPick (auth, post author only) ----------
// One pick per post: any prior pick is unset before setting the new one.
export const markCounselPick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid(), commentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: post } = await supabaseAdmin
      .from("posts").select("author_id").eq("id", data.postId).maybeSingle();
    if (!post || (post as { author_id: string }).author_id !== userId) {
      throw new Error("Only the story author can mark a counsel pick.");
    }
    await supabaseAdmin.from("post_comments")
      .update({ is_counsel_pick: false }).eq("post_id", data.postId).eq("is_counsel_pick", true);
    const { error } = await supabaseAdmin.from("post_comments")
      .update({ is_counsel_pick: true }).eq("id", data.commentId).eq("post_id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- getCachedCommentSummary (public; 1h cache) ----------
export interface CommentSummary {
  majorityTheme: string | null;
  minorityTheme: string | null;
  majorityVerdict: string | null;
  commentCountAtGen: number;
  generatedAt: string;
}
export const getCachedCommentSummary = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<CommentSummary | null> => {
    const { data: row } = await supabaseAdmin
      .from("comment_ai_summaries")
      .select("majority_theme, minority_theme, majority_verdict, comment_count_at_gen, generated_at, expires_at")
      .eq("post_id", data.postId)
      .maybeSingle();
    if (!row) return null;
    const r = row as { majority_theme: string | null; minority_theme: string | null; majority_verdict: string | null; comment_count_at_gen: number; generated_at: string; expires_at: string };
    if (new Date(r.expires_at).getTime() < Date.now()) return null;
    return {
      majorityTheme: r.majority_theme,
      minorityTheme: r.minority_theme,
      majorityVerdict: r.majority_verdict,
      commentCountAtGen: r.comment_count_at_gen,
      generatedAt: r.generated_at,
    };
  });

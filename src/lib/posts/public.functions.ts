// Public (unauthenticated) reads for published posts and profile data.
// Uses admin client with explicit filters so RLS is irrelevant for these queries.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { PostRecord, ReactionKind } from "@/lib/posts/types";

// Resolve the caller's userId from a Bearer token if present. Returns null
// for unauthenticated callers. Never trust a client-supplied viewer id.
async function resolveViewerId(): Promise<string | null> {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    if (!token) return null;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const tmp = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await tmp.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}


export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ post: PostRecord | null }> => {
    const { data: row } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("id", data.postId)
      .eq("status", "published")
      .maybeSingle();
    return { post: (row as unknown as PostRecord) ?? null };
  });

export const getPostReactionCounts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ counts: Record<ReactionKind, number> }> => {
    const empty: Record<ReactionKind, number> = {
      been_there: 0,
      worse: 0,
      hug: 0,
      laugh: 0,
      drama: 0,
    };
    const { data: rows } = await supabaseAdmin
      .from("post_reaction_counts")
      .select("kind, count")
      .eq("post_id", data.postId);
    if (!rows) return { counts: empty };
    for (const r of rows as Array<{ kind: ReactionKind; count: number }>) {
      empty[r.kind] = r.count;
    }
    return { counts: empty };
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

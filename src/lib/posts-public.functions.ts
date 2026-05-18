// Public (unauthenticated) reads for published posts. Uses admin client server-side
// with explicit filters so RLS is irrelevant for these specific queries.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PostRecord, ReactionKind } from "@/lib/posts/types";

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

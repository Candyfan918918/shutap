// Engagement: reactions, share recording, forward recording.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        platform: z.enum([
          "x",
          "tiktok",
          "instagram",
          "xiaohongshu",
          "facebook",
          "imessage",
          "whatsapp",
          "copy_link",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("post_shares").insert({
      post_id: data.postId,
      user_id: userId,
      platform: data.platform,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactToPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        kind: z.enum(["been_there", "worse", "hug", "laugh", "drama"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_reactions")
      .upsert(
        { post_id: data.postId, user_id: userId, kind: data.kind },
        { onConflict: "post_id,user_id,kind", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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

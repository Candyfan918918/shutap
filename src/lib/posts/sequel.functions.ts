// Sequel + Case Closed — short author flows that create a linked follow-up post.
// Sequels: sequel_of FK + notification to past voters.
// Close case: case_closed_of FK + ribbon timestamp + closing line.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SequelSchema = z.object({
  originalPostId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  storyText: z.string().trim().min(20).max(4000),
  visibility: z.enum(["public", "friends", "private"]).default("public"),
});

export const createSequel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SequelSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: original } = await supabaseAdmin
      .from("posts").select("id, author_id, title").eq("id", data.originalPostId).maybeSingle();
    if (!original) throw new Error("Original story not found.");
    if ((original as { author_id: string }).author_id !== userId) {
      throw new Error("Only the author can post a sequel.");
    }
    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .insert({
        author_id: userId,
        title: data.title,
        story_text: data.storyText,
        status: "published",
        visibility: data.visibility,
        published_at: new Date().toISOString(),
        sequel_of: data.originalPostId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed.");

    // Notify every voter on the original story.
    const { data: voters } = await supabaseAdmin
      .from("post_verdict_votes").select("user_id").eq("post_id", data.originalPostId);
    const ids = Array.from(new Set((voters ?? []).map((v: { user_id: string }) => v.user_id)));
    if (ids.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        ids.map((uid) => ({
          user_id: uid,
          kind: "sequel_posted",
          payload: {
            original_post_id: data.originalPostId,
            sequel_post_id: (row as { id: string }).id,
            title: (original as { title: string }).title,
            message: "New information. Does your verdict change?",
          },
        })),
      );
    }
    return { id: (row as { id: string }).id };
  });

const CloseSchema = z.object({
  originalPostId: z.string().uuid(),
  whatHappened: z.string().trim().min(10).max(2000),
  howYouFeel: z.string().trim().min(3).max(500),
  whatChanged: z.string().trim().min(3).max(500),
  benchClosingLine: z.string().trim().max(280).optional(),
});

export const closeCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CloseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: original } = await supabaseAdmin
      .from("posts").select("id, author_id, title").eq("id", data.originalPostId).maybeSingle();
    if (!original) throw new Error("Original story not found.");
    if ((original as { author_id: string }).author_id !== userId) {
      throw new Error("Only the author can close a case.");
    }
    const body = [
      `**What happened:** ${data.whatHappened}`,
      `**How I feel now:** ${data.howYouFeel}`,
      `**What changed:** ${data.whatChanged}`,
    ].join("\n\n");

    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .insert({
        author_id: userId,
        title: `Case closed: ${(original as { title: string }).title}`.slice(0, 120),
        story_text: body,
        status: "published",
        visibility: "public",
        published_at: new Date().toISOString(),
        case_closed_of: data.originalPostId,
        case_closed_summary: data.benchClosingLine ?? null,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed.");

    await supabaseAdmin
      .from("posts")
      .update({ case_closed_at: new Date().toISOString() } as never)
      .eq("id", data.originalPostId);

    return { id: (row as { id: string }).id };
  });

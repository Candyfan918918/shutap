// Moderation: flag | dispute | retract | appeal | resolve_claim
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ActionEnum = z.enum(["flag", "dispute", "retract", "appeal", "resolve_claim"]);

const InputSchema = z.object({
  story_id: z.string().uuid(),
  action: ActionEnum,
  reason: z.string().max(2000).optional(),
  claimer_id: z.string().uuid().optional(),
});

export type ModerationResult = {
  data: { event_id: string } | null;
  error: string | null;
};

export const moderate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ModerationResult> => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Always log a safety_event.
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("safety_events")
      .insert({
        user_id: ctx.userId,
        post_id: data.story_id,
        action: data.action,
        reasons: data.reason ? [data.reason] : [],
      })
      .select("id")
      .single();

    if (evErr) return { data: null, error: evErr.message };

    // 2. Side effects per action (stories.status enum: draft|pending|published|removed|sensitive).
    if (data.action === "retract") {
      await supabaseAdmin
        .from("stories")
        .update({ status: "removed" })
        .eq("id", data.story_id);
    } else if (data.action === "resolve_claim" && data.claimer_id) {
      await supabaseAdmin
        .from("post_approvals")
        .insert({
          post_id: data.story_id,
          user_id: ctx.userId,
          claimer_id: data.claimer_id,
          status: "approved",
          version_snapshot: {},
        });
      await supabaseAdmin
        .from("safety_events")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", ev.id);
    } else if (data.action === "flag") {
      await supabaseAdmin
        .from("stories")
        .update({ status: "sensitive" })
        .eq("id", data.story_id);
    }

    return { data: { event_id: ev.id }, error: null };
  });

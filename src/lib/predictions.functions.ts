// Predictions — community guesses on how a story will end.
// Options come from posts.prediction_options (set by the tagger agent).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubmitSchema = z.object({
  post_id: z.string().uuid(),
  predicted_outcome: z.string().min(1).max(200),
  confidence: z.number().int().min(1).max(5).default(3),
});

const ListSchema = z.object({ post_id: z.string().uuid() });

export type PredictionOption = { label: string; count: number };
export type PredictionSummary = {
  options: PredictionOption[];
  total: number;
  myPick: string | null;
  locked: boolean;
};

export const submitPrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lock once a story_outcome exists.
    const { count: outcomeCount } = await supabaseAdmin
      .from("story_outcomes")
      .select("id", { count: "exact", head: true })
      .eq("post_id", data.post_id);
    if ((outcomeCount ?? 0) > 0) {
      return { data: null, error: "Predictions are locked — outcome already in." };
    }

    // Upsert (one prediction per user per post).
    const { data: existing } = await supabaseAdmin
      .from("predictions")
      .select("id")
      .eq("post_id", data.post_id)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("predictions")
        .update({
          predicted_outcome: data.predicted_outcome,
          confidence: data.confidence,
        })
        .eq("id", existing.id);
      if (error) return { data: null, error: error.message };
    } else {
      const { error } = await supabaseAdmin.from("predictions").insert({
        post_id: data.post_id,
        user_id: ctx.userId,
        predicted_outcome: data.predicted_outcome,
        confidence: data.confidence,
      });
      if (error) return { data: null, error: error.message };
    }
    return { data: { ok: true }, error: null };
  });

export const getPredictionSummary = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ListSchema.parse(i))
  .handler(async ({ data }): Promise<{ data: PredictionSummary | null; error: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: post }, { data: rows }, { data: outcome }] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("prediction_options")
        .eq("id", data.post_id)
        .maybeSingle(),
      supabaseAdmin
        .from("predictions")
        .select("predicted_outcome, user_id")
        .eq("post_id", data.post_id),
      supabaseAdmin
        .from("story_outcomes")
        .select("id")
        .eq("post_id", data.post_id)
        .maybeSingle(),
    ]);

    const opts: string[] = Array.isArray(post?.prediction_options)
      ? (post!.prediction_options as string[])
      : [];

    const counts = new Map<string, number>();
    for (const o of opts) counts.set(o, 0);
    for (const r of rows ?? []) {
      const k = (r as any).predicted_outcome as string;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    return {
      data: {
        options: Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
        total: rows?.length ?? 0,
        myPick: null,
        locked: !!outcome,
      },
      error: null,
    };
  });

export const getMyPrediction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("predictions")
      .select("predicted_outcome, confidence")
      .eq("post_id", data.post_id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    return { data: row ?? null, error: null };
  });

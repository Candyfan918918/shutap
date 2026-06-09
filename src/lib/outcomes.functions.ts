// Outcomes — plaintiff submits how the story actually ended.
// Locks predictions, evaluates them into prediction_results,
// notifies anyone who predicted, and queues the Wisdom Graph writer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OUTCOME_TYPES = [
  "reconciled",
  "ended",
  "no_change",
  "escalated",
  "still_unresolved",
  "other",
] as const;

const SubmitSchema = z.object({
  post_id: z.string().uuid(),
  outcome_type: z.enum(OUTCOME_TYPES),
  detail: z.string().max(500).optional(),
  days_elapsed: z.number().int().min(0).max(3650).optional(),
});

export type OutcomeSubmitResult = {
  data: { id: string; correctCount: number; totalPredictions: number } | null;
  error: string | null;
};

export const submitOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data, context }): Promise<OutcomeSubmitResult> => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize: plaintiff only.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, author_id, title")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) return { data: null, error: "Post not found." };
    if (post.author_id !== ctx.userId) {
      return { data: null, error: "Only the plaintiff can submit an outcome." };
    }

    // One outcome per post.
    const { data: existing } = await supabaseAdmin
      .from("story_outcomes")
      .select("id")
      .eq("post_id", data.post_id)
      .maybeSingle();
    if (existing) return { data: null, error: "Outcome already submitted." };

    const { data: inserted, error } = await supabaseAdmin
      .from("story_outcomes")
      .insert({
        post_id: data.post_id,
        submitted_by: ctx.userId,
        outcome_type: data.outcome_type,
        detail: data.detail ?? null,
        days_elapsed: data.days_elapsed ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) return { data: null, error: error?.message ?? "Insert failed." };

    // Evaluate predictions — a prediction is "correct" when its
    // predicted_outcome matches outcome_type OR equals the detail label.
    const { data: preds } = await supabaseAdmin
      .from("predictions")
      .select("id, user_id, predicted_outcome")
      .eq("post_id", data.post_id);

    let correctCount = 0;
    for (const p of preds ?? []) {
      const guess = (p as any).predicted_outcome as string;
      const is_correct =
        guess === data.outcome_type ||
        (typeof data.detail === "string" &&
          guess.trim().toLowerCase() === data.detail.trim().toLowerCase());
      if (is_correct) correctCount += 1;
      await supabaseAdmin.from("prediction_results").upsert(
        {
          prediction_id: (p as any).id,
          post_id: data.post_id,
          user_id: (p as any).user_id,
          is_correct,
          scored_at: new Date().toISOString(),
        },
        { onConflict: "prediction_id" },
      );

      // Notify the predictor.
      await supabaseAdmin.from("notifications").insert({
        user_id: (p as any).user_id,
        kind: "prediction_resolved",
        payload: {
          post_id: data.post_id,
          is_correct,
          outcome_type: data.outcome_type,
          title: post.title,
          message: is_correct
            ? "Called it. Your prediction matched the outcome."
            : "The Bench called it differently. The outcome is in.",
        },
      });
    }

    // Fire Wisdom Graph writer (best-effort; never block).
    void (async () => {
      try {
        const { runMoment } = await import("@/lib/orchestrator.server");
        await runMoment({
          moment: "wisdom_graph",
          payload: {
            post_id: data.post_id,
            outcome_type: data.outcome_type,
            days_elapsed: data.days_elapsed ?? null,
          },
          userId: ctx.userId,
        });
      } catch {
        /* swallow — graph backfill can retry */
      }
    })();

    return {
      data: {
        id: (inserted as any).id as string,
        correctCount,
        totalPredictions: preds?.length ?? 0,
      },
      error: null,
    };
  });

const GetSchema = z.object({ post_id: z.string().uuid() });

export const getOutcome = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => GetSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("story_outcomes")
      .select("id, outcome_type, detail, days_elapsed, created_at")
      .eq("post_id", data.post_id)
      .maybeSingle();
    return { data: row ?? null, error: null };
  });

export const OUTCOME_LABELS: Record<(typeof OUTCOME_TYPES)[number], string> = {
  reconciled: "We reconciled",
  ended: "We ended it",
  no_change: "Nothing changed",
  escalated: "It got worse",
  still_unresolved: "Still unresolved",
  other: "Something else",
};

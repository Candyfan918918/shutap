// Reputation engine — recompute justice/wisdom/empathy/prediction scores,
// pick a juror title, push a notification when the title changes.
// Exposes both a server function (manual recalc) and an internal helper
// (`recordReputationEvent`) for orchestrator-style calls.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ReputationScores {
  justice_score: number;
  wisdom_score: number;
  empathy_score: number;
  prediction_score: number;
}

export interface ReputationResult {
  scores: ReputationScores;
  juror_title: string;
  title_changed: boolean;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function titleFor(s: ReputationScores, judgments: number): string {
  // Order matters: check highest tier first.
  if (
    s.justice_score > 70 &&
    s.wisdom_score > 70 &&
    s.empathy_score > 70 &&
    s.prediction_score > 70 &&
    judgments >= 500
  )
    return "👑 Legend of the Court";
  if (s.justice_score > 75 && s.wisdom_score > 40) return "🦉 Unrobed Judge";
  if (s.wisdom_score > 60) return "🗣 Voice of Reason";
  if (s.justice_score > 60 && judgments >= 100) return "⚖️ Justice Messenger";
  if (s.wisdom_score > 20 || judgments >= 50) return "🕵️ Story Sleuth";
  return "🍿 Popcorn Witness";
}

export async function recordReputationEvent(args: {
  userId: string;
  eventType: string;
  postId?: string | null;
  caseId?: string | null;
  delta?: Record<string, unknown>;
}): Promise<ReputationResult | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin.from("reputation_events").insert({
    user_id: args.userId,
    event_type: args.eventType,
    post_id: args.postId ?? null,
    case_id: args.caseId ?? null,
    delta: (args.delta ?? {}) as never,
  });

  // Pull primitive signals in parallel.
  const [{ data: profile }, { data: votes }, { data: comments }, { data: preds }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, juror_title, justice_score, wisdom_score, empathy_score, prediction_score",
        )
        .eq("id", args.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("post_id, kind")
        .eq("user_id", args.userId),
      supabaseAdmin
        .from("post_comments")
        .select("like_count, status, deleted_at")
        .eq("user_id", args.userId),
      supabaseAdmin
        .from("predictions")
        .select("id, post_id")
        .eq("user_id", args.userId),
    ]);

  // justice_score — share of votes that matched the case's final_verdict.
  const judgments = (votes ?? []).length;
  let matched = 0;
  if (judgments > 0) {
    const postIds = Array.from(new Set((votes ?? []).map((v: any) => v.post_id)));
    const { data: cases } = await supabaseAdmin
      .from("court_cases")
      .select("post_id, final_verdict")
      .in("post_id", postIds);
    const verdictByPost = new Map<string, string | null>();
    for (const c of (cases ?? []) as any[]) verdictByPost.set(c.post_id, c.final_verdict);
    for (const v of (votes ?? []) as any[]) {
      const fv = verdictByPost.get(v.post_id);
      if (fv && fv === v.kind) matched += 1;
    }
  }
  const justice_score = judgments > 0 ? clamp((matched / judgments) * 100) : 0;

  // wisdom_score — capped sum of comment upvotes.
  const upvotes = (comments ?? [])
    .filter((c: any) => c.status === "published" && !c.deleted_at)
    .reduce((acc: number, c: any) => acc + (Number(c.like_count) || 0), 0);
  const wisdom_score = clamp(upvotes);

  // empathy_score — baseline 50, +1 per upvote (capped contribution 30),
  // -2 per flagged/removed comment.
  const flagged = (comments ?? []).filter(
    (c: any) => c.status !== "published" || c.deleted_at,
  ).length;
  const empathy_score = clamp(50 + Math.min(30, upvotes) - flagged * 2);

  // prediction_score — share of correct predictions, min 10 total to count.
  const predIds = (preds ?? []).map((p: any) => p.id);
  let correct = 0;
  let totalPred = 0;
  if (predIds.length > 0) {
    const { data: results } = await supabaseAdmin
      .from("prediction_results")
      .select("is_correct")
      .in("prediction_id", predIds);
    totalPred = (results ?? []).length;
    correct = (results ?? []).filter((r: any) => r.is_correct).length;
  }
  const prediction_score = totalPred >= 10 ? clamp((correct / totalPred) * 100) : 0;

  const scores: ReputationScores = {
    justice_score,
    wisdom_score,
    empathy_score,
    prediction_score,
  };
  const juror_title = titleFor(scores, judgments);
  const title_changed = !!profile && profile.juror_title !== juror_title;

  await supabaseAdmin
    .from("profiles")
    .update({
      justice_score,
      wisdom_score,
      empathy_score,
      prediction_score,
      juror_title,
    })
    .eq("id", args.userId);

  if (title_changed) {
    await supabaseAdmin.from("notifications").insert({
      user_id: args.userId,
      kind: "juror_title_changed",
      payload: {
        previous: profile?.juror_title ?? null,
        current: juror_title,
        message: `New title: ${juror_title}.`,
      },
    });
  }

  return { scores, juror_title, title_changed };
}

const RecalcSchema = z.object({
  user_id: z.string().uuid().optional(),
  event_type: z.string().min(1).default("manual"),
});

export const recalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecalcSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ data: ReputationResult | null; error: string | null }> => {
      const ctx = context as { userId: string };
      const target = data.user_id ?? ctx.userId;
      // Only allow self-recalc unless we expand to admin later.
      if (target !== ctx.userId) {
        return { data: null, error: "Forbidden." };
      }
      const r = await recordReputationEvent({
        userId: target,
        eventType: data.event_type,
      });
      return { data: r, error: null };
    },
  );

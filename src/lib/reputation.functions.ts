// Reputation engine — recalc 4 scores per user and update juror_title.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  user_id: z.string().uuid(),
  event_type: z.string().min(1),
  event_data: z.record(z.string(), z.unknown()).default({}),
});

interface ReputationScores {
  jury_accuracy: number;
  story_quality: number;
  engagement: number;
  longevity: number;
}

export type ReputationResult = {
  data: { scores: ReputationScores; juror_title: string } | null;
  error: string | null;
};

function titleFor(scores: ReputationScores): string {
  const total = scores.jury_accuracy + scores.story_quality + scores.engagement + scores.longevity;
  if (total >= 380) return "Chief Justice";
  if (total >= 280) return "Senior Juror";
  if (total >= 180) return "Juror";
  if (total >= 80) return "Apprentice";
  return "Petitioner";
}

export const recalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ReputationResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull primitive signals in parallel.
    const [{ data: votes }, { data: stories }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("post_verdict_votes")
        .select("kind, quarantined")
        .eq("user_id", data.user_id),
      supabaseAdmin
        .from("stories")
        .select("id, score")
        .eq("author_id", data.user_id),
      supabaseAdmin
        .from("profiles")
        .select("account_created_at")
        .eq("id", data.user_id)
        .maybeSingle(),
    ]);

    const cleanVotes = (votes ?? []).filter((v: any) => !v.quarantined).length;
    const totalVotes = (votes ?? []).length || 1;
    const jury_accuracy = Math.round((cleanVotes / totalVotes) * 100);

    const storyScores = (stories ?? []).map((s: any) => Number(s.score) || 0);
    const story_quality = storyScores.length
      ? Math.round(storyScores.reduce((a, b) => a + b, 0) / storyScores.length)
      : 0;

    const engagement = Math.min(100, (votes?.length ?? 0) + (stories?.length ?? 0) * 2);

    const createdAt = profile?.account_created_at
      ? new Date(profile.account_created_at).getTime()
      : Date.now();
    const days = Math.max(0, (Date.now() - createdAt) / 86400000);
    const longevity = Math.min(100, Math.round(days / 3));

    const scores: ReputationScores = { jury_accuracy, story_quality, engagement, longevity };
    const juror_title = titleFor(scores);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ juror_title })
      .eq("id", data.user_id);

    if (error) return { data: null, error: error.message };
    return { data: { scores, juror_title }, error: null };
  });

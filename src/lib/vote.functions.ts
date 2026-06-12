// Vote — verdicts on posts/stories with weighting + velocity quarantine.
// Spec weighting:
//   read_depth_percent: <40 → 0.5x, 40–80 → 1.0x, 80+ → 1.5x
//   account age <7d → ×0.3
//   velocity: 10+ same ip_hash within 5min → quarantined=true
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";

const VERDICT_KINDS = [
  "red_flag",
  "green_flag",
  "run",
  "talk_it_out",
  "lawyer_up",
  "therapy_might_help",
  "need_update",
] as const;

const InputSchema = z.object({
  story_id: z.string().uuid(),
  verdict: z.enum(VERDICT_KINDS),
  read_depth_percent: z.number().int().min(0).max(100).default(0),
});

export type VoteResult = {
  data: { weight: number; quarantined: boolean } | null;
  error: string | null;
};

async function hashIp(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function depthWeight(p: number): number {
  if (p < 40) return 0.5;
  if (p < 80) return 1.0;
  return 1.5;
}

export const castVerdict = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VoteResult> => {
    const ctx = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("account_created_at")
      .eq("id", ctx.userId)
      .maybeSingle();

    const ageDays = profile?.account_created_at
      ? (Date.now() - new Date(profile.account_created_at).getTime()) / 86400000
      : 999;
    const ageMul = ageDays < 7 ? 0.3 : 1.0;
    const weight = depthWeight(data.read_depth_percent) * ageMul;

    const rawIp =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("x-real-ip") ??
      null;
    const ip_hash = await hashIp(rawIp);

    // Velocity check: 10+ votes by this user in last 5 min.
    // Uses user_id (not ip_hash) so signed-in abusers are caught even across IPs.
    let quarantined = false;
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("created_at", fiveMinAgo);
    if ((count ?? 0) >= 10) quarantined = true;

    const { error } = await supabaseAdmin
      .from("post_verdict_votes")
      .upsert(
        {
          post_id: data.story_id,
          user_id: ctx.userId,
          kind: data.verdict,
          weight,
          read_depth_percent: data.read_depth_percent,
          ip_hash,
          quarantined,
        },
        { onConflict: "post_id,user_id" },
      );

    if (error) return { data: null, error: error.message };

    // Fire-and-forget HOF update; never await.
    void (async () => {
      try {
        const { runMoment } = await import("@/lib/orchestrator.server");
        await runMoment({
          moment: "hof_update",
          payload: { event: "vote", post_id: data.story_id, weight },
          userId: ctx.userId,
        });
      } catch {
        // Ignore — vote already recorded.
      }
    })();

    // Fire-and-forget nomination recompute.
    void (async () => {
      try {
        const { bumpNomination } = await import("@/lib/nomination.functions");
        bumpNomination(data.story_id);
      } catch {
        /* ignore */
      }
    })();


    return { data: { weight, quarantined }, error: null };
  });

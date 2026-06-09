// Hall of Fame engine — scores entities and snapshots period boundaries.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  event_type: z.string().min(1),
  entity_type: z.enum(["user", "story", "case"]),
  entity_id: z.string().uuid(),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export type HofResult = {
  data: { score: number; period: string } | null;
  error: string | null;
};

function periodKey(now = new Date()): { weekly: string; monthly: string; all: string } {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  // ISO week (simplified)
  const onejan = Date.UTC(y, 0, 1);
  const week = Math.ceil(((now.getTime() - onejan) / 86400000 + 1) / 7);
  return { weekly: `${y}-W${week}`, monthly: `${y}-${m}`, all: "all" };
}

export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<HofResult> => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runMoment } = await import("@/lib/orchestrator.server");

    let score = 0;
    let metrics: Record<string, unknown> = { ...data.metrics };

    try {
      const r = await runMoment({
        moment: "hof_update",
        payload: {
          event_type: data.event_type,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          metrics: data.metrics,
        },
        userId: ctx.userId,
      });
      const output: any = r.results[0]?.output ?? {};
      if (typeof output.score === "number") score = output.score;
      if (output.metrics && typeof output.metrics === "object") metrics = output.metrics;
    } catch {
      // If the agent fails, fall back to a simple sum of numeric metrics.
      score = Object.values(data.metrics).reduce<number>(
        (s, v) => (typeof v === "number" ? s + v : s),
        0,
      );
    }

    const periods = periodKey();
    for (const period of ["all", "monthly", "weekly"] as const) {
      await supabaseAdmin
        .from("hof_scores")
        .upsert(
          {
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            period,
            score,
            metrics: metrics as Record<string, any>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,entity_id,period" },
        );
    }

    // Period boundary snapshot: if the current weekly key hasn't been snapshotted, snapshot.
    const { count } = await supabaseAdmin
      .from("hof_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("period", periods.weekly);

    if (!count) {
      const { data: top } = await supabaseAdmin
        .from("hof_scores")
        .select("entity_type, entity_id, score")
        .eq("period", "weekly")
        .order("score", { ascending: false })
        .limit(50);
      const now = new Date();
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 7);
      await supabaseAdmin.from("hof_snapshots").insert({
        period: periods.weekly,
        period_start: start.toISOString(),
        period_end: now.toISOString(),
        payload: { top: top ?? [] },
      });
    }

    return { data: { score, period: periods.all }, error: null };
  });

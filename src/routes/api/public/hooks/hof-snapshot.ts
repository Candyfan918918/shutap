// Cron-callable snapshot endpoint. Called by pg_cron at the start of each
// daily / weekly cycle. Use ?period=daily|weekly.
import { createFileRoute } from "@tanstack/react-router";
import { runSnapshot } from "@/lib/hof.functions";
import type { HofPeriod } from "@/lib/hof-categories";

export const Route = createFileRoute("/api/public/hooks/hof-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let period: HofPeriod = "daily";
        try {
          const body = (await request.json()) as { period?: HofPeriod };
          if (body?.period === "weekly" || body?.period === "monthly" || body?.period === "daily") {
            period = body.period;
          }
        } catch { /* default daily */ }
        try {
          const result = await runSnapshot(period);
          return Response.json({ ok: true, period, ...result });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: e?.message ?? "snapshot_failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

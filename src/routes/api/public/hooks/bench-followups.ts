// Daily Bench follow-up generator (Prompt 6).
// pg_cron should POST here once per day.
//
// Selects decided court cases 14+ days old whose post has no follow-up yet
// and no outcome submitted, and inserts a Bench follow-up row per post.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runFollowUpFor } from "@/lib/bench/bench.functions";

export const Route = createFileRoute("/api/public/hooks/bench-followups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.COURT_HOOK_SECRET;
        if (!expected) return new Response("Server misconfigured", { status: 500 });
        if (request.headers.get("x-hook-secret") !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
        const { data: cases } = await supabaseAdmin
          .from("court_cases")
          .select("post_id, decided_at")
          .eq("status", "decided")
          .lte("decided_at", cutoff)
          .order("decided_at", { ascending: false })
          .limit(50);

        let written = 0;
        for (const c of (cases ?? []) as any[]) {
          // Skip if outcome already submitted, or follow-up already written.
          const [{ count: hasOutcome }, { count: hasFollowup }] = await Promise.all([
            supabaseAdmin
              .from("story_outcomes")
              .select("id", { count: "exact", head: true })
              .eq("post_id", c.post_id),
            supabaseAdmin
              .from("bench_followups")
              .select("id", { count: "exact", head: true })
              .eq("post_id", c.post_id),
          ]);
          if ((hasOutcome ?? 0) > 0) continue;
          if ((hasFollowup ?? 0) > 0) continue;
          if (await runFollowUpFor(c.post_id)) written += 1;
        }

        return Response.json({ ok: true, written, at: new Date().toISOString() });
      },
    },
  },
});

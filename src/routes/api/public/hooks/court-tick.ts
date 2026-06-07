// Public scheduling hook for the Relationship Court™ lifecycle.
// Called every 15 minutes by pg_cron.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/court-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Shared-secret check: this endpoint mutates admin state, so any
        // unauthenticated caller would otherwise be able to drive the court lifecycle.
        const expected = process.env.COURT_HOOK_SECRET;
        if (!expected) return new Response("Server misconfigured", { status: 500 });
        const provided = request.headers.get("x-hook-secret");
        if (provided !== expected) return new Response("Forbidden", { status: 403 });

        const regions: Array<{ scope: "world" | "country"; code: string; label: string }> = [
          { scope: "world", code: "WORLD", label: "World" },
          { scope: "country", code: "US", label: "🇺🇸 US" },
          { scope: "country", code: "GB", label: "🇬🇧 UK" },
          { scope: "country", code: "CA", label: "🇨🇦 Canada" },
          { scope: "country", code: "AU", label: "🇦🇺 Australia" },
          { scope: "country", code: "JP", label: "🇯🇵 Japan" },
          { scope: "country", code: "IN", label: "🇮🇳 India" },
        ];

        let nominated = 0;
        for (const r of regions) {
          const { data, error } = await supabaseAdmin.rpc("nominate_court_cases", {
            _scope: r.scope,
            _region_code: r.code,
            _region_label: r.label,
            _limit: r.scope === "world" ? 5 : 3,
          });
          if (!error && typeof data === "number") nominated += data;
        }

        const { data: promoted } = await supabaseAdmin.rpc("promote_court_cases");
        const { data: finalized } = await supabaseAdmin.rpc("finalize_court_cases");

        return Response.json({
          ok: true,
          nominated,
          promoted: promoted ?? 0,
          finalized: finalized ?? 0,
          at: new Date().toISOString(),
        });
      },
    },
  },
});

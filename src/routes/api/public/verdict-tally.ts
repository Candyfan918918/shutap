// Public read-only endpoint: total verdict count for the landing trust bar.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/verdict-tally")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { count } = await supabaseAdmin
            .from("post_verdict_votes")
            .select("*", { count: "exact", head: true });
          return Response.json(
            { total: count ?? 0 },
            { headers: { "cache-control": "public, max-age=5" } },
          );
        } catch {
          return Response.json({ total: 0 });
        }
      },
    },
  },
});

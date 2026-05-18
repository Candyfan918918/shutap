// Deep-link redirect: /s/:postId?ref=platform → /post/:postId?ref=platform
// Increments referrer_clicks on the most recent matching share.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/s/$postId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const ref = url.searchParams.get("ref") ?? "unknown";
        const postId = params.postId;

        // Best-effort click count (non-blocking semantics)
        try {
          const { data: row } = await supabaseAdmin
            .from("post_shares")
            .select("id, referrer_clicks")
            .eq("post_id", postId)
            .eq("platform", ref as never)
            .order("shared_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (row) {
            await supabaseAdmin
              .from("post_shares")
              .update({ referrer_clicks: (row.referrer_clicks ?? 0) + 1 })
              .eq("id", row.id);
          }
        } catch { /* ignore */ }

        const dest = `${url.origin}/post/${postId}?ref=${encodeURIComponent(ref)}`;
        return new Response(null, { status: 302, headers: { Location: dest } });
      },
    },
  },
});

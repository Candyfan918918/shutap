// One entry per court region currently or recently in session.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE = "https://shutap.com";

export const Route = createFileRoute("/sitemap-courts.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("court_cases")
          .select("region_code, region_label, nominated_at")
          .order("nominated_at", { ascending: false })
          .limit(2000);
        const seen = new Set<string>();
        const urls: string[] = [`  <url><loc>${BASE}/court</loc><changefreq>hourly</changefreq></url>`];
        for (const r of (data ?? []) as any[]) {
          const code = (r.region_code as string | null) ?? "";
          if (!code || seen.has(code)) continue;
          seen.add(code);
          urls.push(`  <url><loc>${BASE}/court?region=${encodeURIComponent(code)}</loc></url>`);
        }
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=1800" },
        });
      },
    },
  },
});

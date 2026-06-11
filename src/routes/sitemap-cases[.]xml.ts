// Public, published cases — one entry per post.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE = "https://shutap.com";

export const Route = createFileRoute("/sitemap-cases.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("posts")
          .select("id, updated_at, published_at")
          .eq("status", "published")
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("published_at", { ascending: false })
          .limit(5000);
        const urls = ((data ?? []) as any[]).map((p) => {
          const lastmod = (p.updated_at ?? p.published_at ?? "").toString().slice(0, 10);
          return `  <url><loc>${BASE}/post/${p.id}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
        });
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

// Public, published cases — one entry per post. Outcome-aware priority/changefreq.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE = "https://shutap.com";

export const Route = createFileRoute("/sitemap-cases.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: posts }, { data: outcomes }] = await Promise.all([
          supabaseAdmin
            .from("posts")
            .select("id, updated_at, published_at")
            .eq("status", "published")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("published_at", { ascending: false })
            .limit(5000),
          supabaseAdmin.from("story_outcomes").select("post_id, created_at").limit(10000),
        ]);
        const outcomeMap = new Map<string, string>();
        for (const o of (outcomes ?? []) as any[]) {
          const prev = outcomeMap.get(o.post_id);
          if (!prev || (o.created_at && o.created_at > prev)) outcomeMap.set(o.post_id, o.created_at);
        }
        const urls = ((posts ?? []) as any[]).map((p) => {
          const outcomeAt = outcomeMap.get(p.id);
          const lastmod = (outcomeAt ?? p.updated_at ?? p.published_at ?? "").toString().slice(0, 10);
          const priority = outcomeAt ? "0.9" : "0.7";
          const changefreq = outcomeAt ? "monthly" : "weekly";
          return [
            `  <url>`,
            `    <loc>${BASE}/case/${p.id}</loc>`,
            lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
            `    <changefreq>${changefreq}</changefreq>`,
            `    <priority>${priority}</priority>`,
            `  </url>`,
          ].filter(Boolean).join("\n");
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

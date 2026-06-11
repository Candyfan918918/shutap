import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE = "https://shutap.com";
const STATIC = ["/", "/court", "/stream", "/hof", "/docket", "/outcomes", "/data", "/data/romance", "/data/family", "/data/work", "/data/friendship", "/data/digital", "/data/stranger", "/data/service"];

export const Route = createFileRoute("/sitemap-static.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC.map(
          (p) => `  <url><loc>${BASE}${p}</loc><changefreq>${p === "/" ? "hourly" : "daily"}</changefreq></url>`,
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

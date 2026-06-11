// Sitemap index — splits into static, cases, courts.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE = "https://shutap.com";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          `  <sitemap><loc>${BASE}/sitemap-static.xml</loc></sitemap>`,
          `  <sitemap><loc>${BASE}/sitemap-cases.xml</loc></sitemap>`,
          `  <sitemap><loc>${BASE}/sitemap-courts.xml</loc></sitemap>`,
          `</sitemapindex>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

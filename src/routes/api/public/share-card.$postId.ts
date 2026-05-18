// Public share-card endpoint:
//   GET /api/public/share-card/:postId           → PNG (square)
//   GET /api/public/share-card/:postId?format=vertical|xhs|square
//   GET /api/public/share-card/:postId?svg=1     → SVG (debug)
//
// First call renders + uploads to the story-media bucket and saves the URL
// on the post row, so subsequent calls 302-redirect to the cached image.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildShareCardSVG,
  SHARE_CARD_DIMENSIONS,
  type ShareCardFormat,
} from "@/lib/share/card-svg";
import { renderSvgToPng } from "@/lib/share/render-png.server";
import { scoreCategoryLabel } from "@/lib/posts/types";

const FORMAT_COLUMN: Record<ShareCardFormat, "share_card_square" | "share_card_vertical" | "share_card_xhs"> = {
  square: "share_card_square",
  vertical: "share_card_vertical",
  xhs: "share_card_xhs",
};

const FORMATS: ShareCardFormat[] = ["square", "vertical", "xhs"];

function parseFormat(v: string | null): ShareCardFormat {
  return (FORMATS as string[]).includes(v ?? "") ? (v as ShareCardFormat) : "square";
}

export const Route = createFileRoute("/api/public/share-card/$postId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const format = parseFormat(url.searchParams.get("format"));
        const wantSvg = url.searchParams.get("svg") === "1";
        const force = url.searchParams.get("force") === "1";
        const postId = params.postId;

        const { data: post, error } = await supabaseAdmin
          .from("posts")
          .select("id, title, badges, score, score_category, status, share_card_square, share_card_vertical, share_card_xhs")
          .eq("id", postId)
          .maybeSingle();

        if (error || !post || post.status !== "published") {
          return new Response("Not found", { status: 404 });
        }

        // Cached?
        const col = FORMAT_COLUMN[format];
        const cached = (post as Record<string, unknown>)[col] as string | null;
        if (!wantSvg && !force && cached) {
          return Response.redirect(cached, 302);
        }

        const svg = buildShareCardSVG({
          format,
          score: post.score ?? 500,
          category: post.score_category ?? scoreCategoryLabel(post.score ?? 500),
          title: post.title,
          badges: (post.badges as string[] | null) ?? [],
          postId: post.id,
        });

        if (wantSvg) {
          return new Response(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        }

        let png: Uint8Array;
        try {
          png = await renderSvgToPng(svg, SHARE_CARD_DIMENSIONS[format].w);
        } catch (e) {
          console.error("share-card render failed", e);
          // Fallback to SVG so social previews still get something.
          return new Response(svg, {
            status: 200,
            headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
          });
        }

        // Upload and cache
        const path = `share-cards/${postId}/${format}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("story-media")
          .upload(path, png, {
            contentType: "image/png",
            upsert: true,
            cacheControl: "31536000",
          });
        if (!upErr) {
          const { data: pub } = supabaseAdmin.storage.from("story-media").getPublicUrl(path);
          if (pub?.publicUrl) {
            const patch: Record<string, string> = { [col]: pub.publicUrl };
            await supabaseAdmin
              .from("posts")
              .update(patch as never)
              .eq("id", postId);
          }
        }

        return new Response(png as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

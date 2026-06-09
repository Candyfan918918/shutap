// Per-case OG image generator — lazy, cached to story-media storage.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/og/case/$caseId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const caseId = params.caseId;
        if (!caseId || caseId.length < 8) return new Response("bad id", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("court_cases")
          .select(
            "id, post_id, status, final_verdict, region_label, current_tier, bench_verdict_line, og_image_url, updated_at",
          )
          .eq("id", caseId)
          .maybeSingle();
        if (!row) return new Response("not found", { status: 404 });

        // Cache key — invalidates when verdict or tier changes.
        const cacheKey = `og/case-${caseId}-${row.final_verdict ?? "open"}-${row.current_tier ?? row.status}.png`;

        // 1. Existing cached URL on the row.
        if ((row as any).og_image_url) {
          return Response.redirect((row as any).og_image_url, 302);
        }

        // 2. Check storage cache.
        const { data: existing } = await supabaseAdmin.storage
          .from("story-media")
          .list("og", { search: cacheKey.split("/").pop() ?? "" });
        if (existing && existing.some((f: any) => f.name === cacheKey.split("/").pop())) {
          const { data: pub } = supabaseAdmin.storage.from("story-media").getPublicUrl(cacheKey);
          if (pub?.publicUrl) {
            await supabaseAdmin.from("court_cases").update({ og_image_url: pub.publicUrl }).eq("id", caseId);
            return Response.redirect(pub.publicUrl, 302);
          }
        }

        const { data: post } = await supabaseAdmin
          .from("posts")
          .select("title")
          .eq("id", row.post_id)
          .maybeSingle();
        const title = (post as any)?.title ?? "A case before the Bench";

        const headline =
          row.bench_verdict_line ??
          (row.status === "decided"
            ? `Verdict in from ${row.region_label} Court`
            : `Now in ${row.region_label} Court`);

        // 3. Generate via Lovable AI image gateway.
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("AI gateway not configured", { status: 500 });

        const prompt = `Editorial poster, dark courtroom backdrop with warm spotlight, gavel silhouette, single bold headline overlay reading "${title.replace(/"/g, "'")}" with subline "${headline.replace(/"/g, "'")}". Cinematic, dramatic, square 1:1. No watermarks, no logos. Bench voice: declarative, dry, no exclamation marks.`;

        let imageDataUrl: string | null = null;
        try {
          const gw = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-image-2",
              prompt,
              quality: "low",
              size: "1024x1024",
            }),
          });
          if (gw.ok) {
            const json = (await gw.json()) as any;
            const b64 = json?.data?.[0]?.b64_json ?? null;
            if (b64) imageDataUrl = b64;
          }
        } catch {
          /* fall through to placeholder */
        }

        if (!imageDataUrl) {
          // Fallback to share-card endpoint.
          return Response.redirect(`/api/public/share-card/${row.post_id}?format=square`, 302);
        }

        // 4. Upload to storage.
        const buf = Uint8Array.from(atob(imageDataUrl), (c) => c.charCodeAt(0));
        const { error: upErr } = await supabaseAdmin.storage
          .from("story-media")
          .upload(cacheKey, buf, { contentType: "image/png", upsert: true });
        if (upErr) {
          return Response.redirect(`/api/public/share-card/${row.post_id}?format=square`, 302);
        }
        const { data: pub } = supabaseAdmin.storage.from("story-media").getPublicUrl(cacheKey);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) return new Response("upload ok but no url", { status: 500 });

        await supabaseAdmin.from("court_cases").update({ og_image_url: publicUrl }).eq("id", caseId);
        return Response.redirect(publicUrl, 302);
      },
    },
  },
});

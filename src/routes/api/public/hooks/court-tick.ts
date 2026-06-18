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

        const regions: Array<{ scope: "world" | "country" | "city"; code: string; label: string; cap: number }> = [
          { scope: "world", code: "WORLD", label: "World", cap: 5 },
          { scope: "country", code: "US", label: "🇺🇸 US", cap: 3 },
          { scope: "country", code: "GB", label: "🇬🇧 UK", cap: 3 },
          { scope: "country", code: "CA", label: "🇨🇦 Canada", cap: 3 },
          { scope: "country", code: "AU", label: "🇦🇺 Australia", cap: 3 },
          { scope: "country", code: "JP", label: "🇯🇵 Japan", cap: 3 },
          { scope: "country", code: "IN", label: "🇮🇳 India", cap: 3 },
        ];

        // City courts come from the admin-managed table — only the active ones.
        const { data: cityCourts } = await supabaseAdmin
          .from("city_courts")
          .select("code, label, nomination_cap, active")
          .eq("active", true);
        for (const cc of (cityCourts ?? []) as any[]) {
          regions.push({
            scope: "city",
            code: cc.code,
            label: cc.label,
            cap: Math.max(0, cc.nomination_cap ?? 3),
          });
        }

        let nominated = 0;
        for (const r of regions) {
          if (r.cap <= 0) continue;
          const { data, error } = await supabaseAdmin.rpc("nominate_court_cases", {
            _scope: r.scope,
            _region_code: r.code,
            _region_label: r.label,
            _limit: r.cap,
          });
          if (!error && typeof data === "number") nominated += data;
        }


        const { data: promoted } = await supabaseAdmin.rpc("promote_court_cases");
        const { data: finalized } = await supabaseAdmin.rpc("finalize_court_cases");

        // Bench verdict line — generate for any case decided in last 30 min
        // that still has no bench_verdict_line.
        let bench_lines = 0;
        const since = new Date(Date.now() - 30 * 60_000).toISOString();
        const { data: pending } = await supabaseAdmin
          .from("court_cases")
          .select("id, post_id, final_verdict, current_tier, region_label, scope")
          .eq("status", "decided")
          .gte("decided_at", since)
          .is("bench_verdict_line", null)
          .limit(20);

        if (pending && pending.length > 0) {
          const { runMoment } = await import("@/lib/orchestrator.server");
          for (const c of pending as any[]) {
            try {
              const [{ data: post }, { data: votes }] = await Promise.all([
                supabaseAdmin
                  .from("posts")
                  .select("title, author_id, both_sides_heard, perspective_count")
                  .eq("id", c.post_id)
                  .maybeSingle(),
                supabaseAdmin
                  .from("post_verdict_votes")
                  .select("kind")
                  .eq("post_id", c.post_id),
              ]);

              const dist: Record<string, number> = {};
              let total = 0;
              for (const v of (votes ?? []) as any[]) {
                dist[v.kind] = (dist[v.kind] ?? 0) + 1;
                total += 1;
              }
              const dominant = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
              const dominant_pct = total > 0 && dominant ? Math.round((dominant[1] / total) * 100) : 0;

              const result = await runMoment({
                moment: "court_verdict_lock",
                payload: {
                  case_title: post?.title ?? "Untitled",
                  alias: "the plaintiff",
                  tier: c.current_tier ?? c.scope ?? "city",
                  region_label: c.region_label,
                  total_votes: total,
                  dominant_verdict: c.final_verdict,
                  dominant_pct,
                  verdict_distribution: dist,
                  both_sides_heard: !!post?.both_sides_heard,
                  perspective_count: post?.perspective_count ?? 0,
                },
                userId: post?.author_id ?? "00000000-0000-0000-0000-000000000000",
                storyId: c.post_id,
              });
              const out = (result.results[0]?.output ?? {}) as any;
              await supabaseAdmin
                .from("court_cases")
                .update({
                  bench_verdict_line: out.bench_verdict_line ?? null,
                  final_judgment: out.final_judgment ?? null,
                })
                .eq("id", c.id);
              bench_lines += 1;

              // Phase 5: recalc reputation for plaintiff + voters on this case.
              try {
                const { recordReputationEvent } = await import(
                  "@/lib/reputation.functions"
                );
                if (post?.author_id) {
                  await recordReputationEvent({
                    userId: post.author_id,
                    eventType: "court_locked_plaintiff",
                    postId: c.post_id,
                    caseId: c.id,
                  });
                }
                const { data: voters } = await supabaseAdmin
                  .from("post_verdict_votes")
                  .select("user_id")
                  .eq("post_id", c.post_id);
                const seen = new Set<string>();
                for (const v of (voters ?? []) as any[]) {
                  if (!v.user_id || seen.has(v.user_id)) continue;
                  if (v.user_id === post?.author_id) continue;
                  seen.add(v.user_id);
                  await recordReputationEvent({
                    userId: v.user_id,
                    eventType: "court_locked_voter",
                    postId: c.post_id,
                    caseId: c.id,
                  });
                }
              } catch {
                /* reputation can retry next tick */
              }
            } catch {
              /* skip this case, try the rest */
            }
          }
        }

        // ---------- Prompt 4: Bench court promotion notes ----------
        // For any case in_court without a bench_promotion_line yet (capped).
        let promotion_notes = 0;
        const { data: needPromo } = await supabaseAdmin
          .from("court_cases")
          .select("id")
          .eq("status", "in_court")
          .is("bench_promotion_line", null)
          .order("nominated_at", { ascending: false })
          .limit(10);
        if (needPromo && needPromo.length > 0) {
          const { runCourtPromotionFor } = await import("@/lib/bench/bench.functions");
          for (const c of needPromo as any[]) {
            if (await runCourtPromotionFor(c.id)) promotion_notes += 1;
          }
        }

        // ---------- Prompt 5: Overturned recap ----------
        // For cases decided in the last 24h, where the post has a seed lean
        // and no overturned recap yet.
        let overturned_recaps = 0;
        const since24 = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
        const { data: needRecap } = await supabaseAdmin
          .from("court_cases")
          .select("id")
          .eq("status", "decided")
          .gte("decided_at", since24)
          .limit(20);
        if (needRecap && needRecap.length > 0) {
          const { runOverturnedRecapFor } = await import("@/lib/bench/bench.functions");
          for (const c of needRecap as any[]) {
            if (await runOverturnedRecapFor(c.id)) overturned_recaps += 1;
          }
        }

        return Response.json({
          ok: true,
          nominated,
          promoted: promoted ?? 0,
          finalized: finalized ?? 0,
          bench_lines,
          promotion_notes,
          overturned_recaps,
          at: new Date().toISOString(),
        });

      },
    },
  },
});

// Admin analytics server functions. Service-role reads; admin/analyst gated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RANGES = ["today", "7d", "30d", "custom"] as const;

async function gate() {
  const { requireAdminSession } = await import("./session.server");
  return requireAdminSession({ roles: ["super_admin", "analyst"] });
}

function rangeStart(range: string, from?: string): Date {
  const now = new Date();
  if (range === "custom" && from) return new Date(from);
  const ms = range === "today" ? 86_400_000 : range === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(now.getTime() - ms);
}

function bucketByDay(rows: Array<{ created_at?: string | null; t?: string | null }>): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const ts = r.created_at ?? r.t ?? null;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
}

export const getAdminAnalytics = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      range: z.enum(RANGES).default("7d"),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = rangeStart(data.range, data.from).toISOString();
    const until = data.range === "custom" && data.to ? new Date(data.to).toISOString() : new Date().toISOString();

    // ---- GROWTH ----
    const [{ data: signups }, { data: posts }, { data: votes }, { data: profilesAll }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, created_at, city, country_code").gte("created_at", since).lte("created_at", until).limit(5000),
      supabaseAdmin.from("posts").select("id, created_at, author_id").gte("created_at", since).lte("created_at", until).limit(5000),
      supabaseAdmin.from("post_verdict_votes").select("user_id, created_at").gte("created_at", since).lte("created_at", until).limit(20000),
      supabaseAdmin.from("profiles").select("id, created_at").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(10000),
    ]);

    const signupSeries = bucketByDay((signups ?? []) as any[]);

    // Retention: D1 / D7 / D30 — share of cohort that voted/posted in the window.
    const cohortIds = new Set((profilesAll ?? []).map((p: any) => p.id as string));
    const activityByUser = new Map<string, Set<string>>();
    for (const v of (votes ?? []) as any[]) {
      if (!v.user_id) continue;
      const day = (v.created_at as string).slice(0, 10);
      if (!activityByUser.has(v.user_id)) activityByUser.set(v.user_id, new Set());
      activityByUser.get(v.user_id)!.add(day);
    }
    for (const p of (posts ?? []) as any[]) {
      if (!p.author_id) continue;
      const day = (p.created_at as string).slice(0, 10);
      if (!activityByUser.has(p.author_id)) activityByUser.set(p.author_id, new Set());
      activityByUser.get(p.author_id)!.add(day);
    }
    const retention = (offsetDays: number) => {
      let eligible = 0, returned = 0;
      for (const p of (profilesAll ?? []) as any[]) {
        const created = new Date(p.created_at);
        const target = new Date(created.getTime() + offsetDays * 86_400_000);
        if (target > new Date()) continue;
        eligible++;
        const days = activityByUser.get(p.id) ?? new Set();
        const targetDay = target.toISOString().slice(0, 10);
        if (days.has(targetDay)) returned++;
      }
      return eligible === 0 ? 0 : Math.round((returned / eligible) * 1000) / 10;
    };
    const retentionCurve = [
      { day: "D1", pct: retention(1) },
      { day: "D7", pct: retention(7) },
      { day: "D30", pct: retention(30) },
    ];

    const cityMap = new Map<string, number>();
    for (const s of (signups ?? []) as any[]) {
      const key = `${s.city ?? "Unknown"}${s.country_code ? ", " + s.country_code : ""}`;
      cityMap.set(key, (cityMap.get(key) ?? 0) + 1);
    }
    const topCities = Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([city, count]) => ({ city, count }));

    // Funnel
    const voters = new Set<string>();
    for (const v of (votes ?? []) as any[]) if (v.user_id) voters.add(v.user_id as string);
    const posters = new Set<string>();
    for (const p of (posts ?? []) as any[]) if (p.author_id) posters.add(p.author_id as string);
    const { count: visitCount } = await supabaseAdmin.from("post_views").select("id", { count: "exact", head: true }).gte("viewed_at", since).lte("viewed_at", until);
    const funnel = [
      { stage: "Visited", count: visitCount ?? 0 },
      { stage: "Voted", count: voters.size },
      { stage: "Signed up", count: cohortIds.size },
      { stage: "First post", count: posters.size },
    ];

    // ---- CONTENT HEALTH ----
    const { data: cases } = await supabaseAdmin
      .from("court_cases").select("id, controversy_score, decided_at, current_category_court")
      .gte("nominated_at", since).lte("nominated_at", until).limit(2000);
    const controversySeries = bucketByDay(
      ((cases ?? []) as any[])
        .filter((c) => (c.controversy_score ?? 0) >= 30)
        .map((c) => ({ created_at: c.decided_at ?? null })),
    );

    const { data: blocked } = await supabaseAdmin
      .from("safety_events").select("id, kind, created_at")
      .gte("created_at", since).lte("created_at", until).limit(2000);
    const blockByCat = new Map<string, number>();
    for (const b of (blocked ?? []) as any[]) {
      const k = (b.kind as string) ?? "unknown";
      blockByCat.set(k, (blockByCat.get(k) ?? 0) + 1);
    }
    const guardianBlocks = Array.from(blockByCat.entries()).map(([cat, count]) => ({ cat, count }));

    const { count: commentTotal } = await supabaseAdmin
      .from("post_comments").select("id", { count: "exact", head: true })
      .gte("created_at", since).lte("created_at", until).is("deleted_at", null);
    const { count: commentLiked } = await supabaseAdmin
      .from("post_comments").select("id", { count: "exact", head: true })
      .gte("created_at", since).lte("created_at", until).gt("like_count", 0).is("deleted_at", null);
    const commentQualityRatio = !commentTotal ? 0 : Math.round(((commentLiked ?? 0) / commentTotal) * 1000) / 10;

    const { count: outcome30 } = await supabaseAdmin
      .from("story_outcomes").select("id", { count: "exact", head: true })
      .lte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
    const { count: outcome90 } = await supabaseAdmin
      .from("story_outcomes").select("id", { count: "exact", head: true })
      .lte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
    const { count: outcome180 } = await supabaseAdmin
      .from("story_outcomes").select("id", { count: "exact", head: true })
      .lte("created_at", new Date(Date.now() - 180 * 86_400_000).toISOString());

    // ---- SAFETY ----
    const { data: modActions } = await supabaseAdmin
      .from("mod_actions").select("action, created_at, ai_recommendation, accepted_ai_rec")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(5000);
    const modByType = new Map<string, number>();
    let withAi = 0, override = 0;
    for (const m of (modActions ?? []) as any[]) {
      modByType.set(m.action, (modByType.get(m.action) ?? 0) + 1);
      if (m.ai_recommendation) {
        withAi++;
        if (!m.accepted_ai_rec) override++;
      }
    }
    const modActionsByType = Array.from(modByType.entries()).map(([type, count]) => ({ type, count }));
    const overrideRate = withAi === 0 ? 0 : Math.round((override / withAi) * 1000) / 10;

    const { data: queueResolved } = await supabaseAdmin
      .from("mod_queue").select("severity, created_at, resolved_at")
      .not("resolved_at", "is", null)
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(5000);
    const resBySev = new Map<string, { total: number; count: number }>();
    for (const q of (queueResolved ?? []) as any[]) {
      const sev = (q.severity as string) ?? "medium";
      const dt = new Date(q.resolved_at as string).getTime() - new Date(q.created_at as string).getTime();
      const cur = resBySev.get(sev) ?? { total: 0, count: 0 };
      cur.total += dt; cur.count += 1;
      resBySev.set(sev, cur);
    }
    const queueResolutionMins = Array.from(resBySev.entries()).map(([sev, v]) => ({
      severity: sev,
      avgMinutes: v.count === 0 ? 0 : Math.round(v.total / v.count / 60_000),
    }));

    const { count: quarantineCount } = await supabaseAdmin
      .from("post_verdict_votes").select("post_id", { count: "exact", head: true })
      .eq("quarantined", true)
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());

    // ---- REVENUE / LEADS ----
    const { data: leads } = await supabaseAdmin
      .from("leads").select("id, pipeline_stage, service_category, partner_id, partner_name, consent_verified_at, sent_to_partner_at, booked_at, converted_at, revoked_at, first_contacted_at, created_at")
      .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()).limit(5000);
    const stageCount = (s: string) => ((leads ?? []) as any[]).filter((l) => l.pipeline_stage === s).length;
    const leadFunnel = [
      { stage: "Surfaced", count: leads?.length ?? 0 },
      { stage: "Consented", count: ((leads ?? []) as any[]).filter((l) => l.consent_verified_at).length },
      { stage: "Sent", count: ((leads ?? []) as any[]).filter((l) => l.sent_to_partner_at).length },
      { stage: "Booked", count: stageCount("booked") + stageCount("converted") },
      { stage: "Converted", count: stageCount("converted") },
    ];
    const revByCat = new Map<string, number>();
    for (const l of (leads ?? []) as any[]) {
      if (l.pipeline_stage !== "converted") continue;
      const k = (l.service_category as string) ?? "unspecified";
      revByCat.set(k, (revByCat.get(k) ?? 0) + 1);
    }
    const revenueByCategory = Array.from(revByCat.entries()).map(([cat, count]) => ({ cat, conversions: count }));

    const partnerMap = new Map<string, { name: string; total: number; sent: number; booked: number; converted: number }>();
    for (const l of (leads ?? []) as any[]) {
      const key = (l.partner_id as string) ?? (l.partner_name as string) ?? "unassigned";
      const cur = partnerMap.get(key) ?? { name: (l.partner_name as string) ?? "Unassigned", total: 0, sent: 0, booked: 0, converted: 0 };
      cur.total += 1;
      if (l.sent_to_partner_at) cur.sent += 1;
      if (l.booked_at || l.pipeline_stage === "booked" || l.pipeline_stage === "converted") cur.booked += 1;
      if (l.pipeline_stage === "converted") cur.converted += 1;
      partnerMap.set(key, cur);
    }
    const partnerPerformance = Array.from(partnerMap.entries()).map(([id, v]) => ({
      partnerId: id,
      partnerName: v.name,
      received: v.total,
      bookingRate: v.sent === 0 ? 0 : Math.round((v.booked / v.sent) * 1000) / 10,
      conversionRate: v.sent === 0 ? 0 : Math.round((v.converted / v.sent) * 1000) / 10,
    }));

    return {
      range: data.range,
      growth: { signupSeries, retentionCurve, topCities, funnel },
      content: { controversySeries, guardianBlocks, commentQualityRatio, outcomeRate: { d30: outcome30 ?? 0, d90: outcome90 ?? 0, d180: outcome180 ?? 0 } },
      safety: { modActionsByType, queueResolutionMins, overrideRate, quarantinedVotes: quarantineCount ?? 0 },
      revenue: { leadFunnel, revenueByCategory, partnerPerformance },
    };
  });

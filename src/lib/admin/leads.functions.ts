// Admin lead management. Service-role; gated by admin session.
// Story content (story_id, user_id link, alias) is never returned.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AnyRow = Record<string, any>;

const STAGES = ["created", "consent_verified", "sent_to_partner", "booked", "converted", "expired", "revoked"] as const;

async function gate() {
  const { requireAdminSession } = await import("./session.server");
  return requireAdminSession({ roles: ["super_admin", "partner_manager"] });
}

function sanitize(row: AnyRow): AnyRow {
  // Drop sensitive identifiers — never expose alias / story content / user link
  const { story_id, user_id, notes, contact, ...safe } = row;
  return safe;
}

export const listLeadPipeline = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, pipeline_stage, service_category, lead_quality, city, country, situation_summary, partner_name, partner_id, consent_verified_at, sent_to_partner_at, first_contacted_at, booked_at, converted_at, revoked_at, partner_notified_at, partner_confirmed_deleted_at, revocation_resolved_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const items = (data ?? []).map((r) => sanitize(r as AnyRow));
    const byStage: Record<string, AnyRow[]> = Object.fromEntries(STAGES.map((s) => [s, []]));
    for (const it of items) {
      const stage = (it.pipeline_stage as string) ?? "created";
      if (byStage[stage]) byStage[stage].push(it);
      else byStage.created.push(it);
    }
    return { stages: STAGES, byStage };
  });

export const getLeadDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leads").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) { const e: any = new Error("not_found"); e.statusCode = 404; throw e; }
    return { lead: sanitize(row as AnyRow) };
  });

export const listRevocationQueue = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, service_category, partner_name, city, country, revoked_at, partner_notified_at, partner_confirmed_deleted_at, revocation_resolved_at, situation_summary")
      .not("revoked_at", "is", null)
      .order("revoked_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map((r) => sanitize(r as AnyRow)) };
  });

export const updateRevocation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["partner_notified", "partner_confirmed_deleted", "resolved"]),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const patch: Record<string, string> = {};
    if (data.action === "partner_notified") patch.partner_notified_at = now;
    if (data.action === "partner_confirmed_deleted") patch.partner_confirmed_deleted_at = now;
    if (data.action === "resolved") patch.revocation_resolved_at = now;
    const { error } = await supabaseAdmin.from("leads").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPartnerPerformance = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("partner_id, partner_name, pipeline_stage, sent_to_partner_at, first_contacted_at, booked_at, converted_at, created_at")
      .gte("created_at", since).limit(5000);
    if (error) throw new Error(error.message);
    const map = new Map<string, AnyRow>();
    for (const l of (data ?? []) as AnyRow[]) {
      const key = (l.partner_id as string) ?? (l.partner_name as string) ?? "unassigned";
      const cur = map.get(key) ?? {
        partnerId: key,
        partnerName: (l.partner_name as string) ?? "Unassigned",
        received: 0, contacted: 0, booked: 0, converted: 0, contactDelays: [] as number[],
      };
      cur.received += 1;
      if (l.first_contacted_at) {
        cur.contacted += 1;
        if (l.sent_to_partner_at) {
          const d = (new Date(l.first_contacted_at).getTime() - new Date(l.sent_to_partner_at).getTime()) / 86_400_000;
          if (d >= 0) cur.contactDelays.push(d);
        }
      }
      if (l.booked_at || l.pipeline_stage === "booked" || l.pipeline_stage === "converted") cur.booked += 1;
      if (l.pipeline_stage === "converted") cur.converted += 1;
      map.set(key, cur);
    }
    const items = Array.from(map.values()).map((v) => ({
      partnerId: v.partnerId, partnerName: v.partnerName, received: v.received,
      contactedRate: v.received === 0 ? 0 : Math.round((v.contacted / v.received) * 1000) / 10,
      bookingRate: v.received === 0 ? 0 : Math.round((v.booked / v.received) * 1000) / 10,
      conversionRate: v.received === 0 ? 0 : Math.round((v.converted / v.received) * 1000) / 10,
      avgDaysToContact: v.contactDelays.length === 0 ? 0 : Math.round((v.contactDelays.reduce((a: number, b: number) => a + b, 0) / v.contactDelays.length) * 10) / 10,
    }));
    return { items };
  });

export const getComplianceReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ month: z.string().optional() }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const month = data.month ?? new Date().toISOString().slice(0, 7);
    const start = new Date(month + "-01T00:00:00Z");
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const { data: rows, error } = await supabaseAdmin
      .from("leads")
      .select("id, pipeline_stage, service_category, partner_name, created_at, consent_verified_at, sent_to_partner_at, revoked_at, revocation_resolved_at")
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).limit(10000);
    if (error) throw new Error(error.message);
    return { month, rows: (rows ?? []) as AnyRow[] };
  });

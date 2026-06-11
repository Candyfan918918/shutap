// Admin AI briefing — server-role reads/writes, gated by admin session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AnyRow = Record<string, any>;
type Role = "super_admin" | "moderator" | "analyst" | "partner_manager";

const VISIBLE_CATEGORIES: Record<Role, string[]> = {
  super_admin: ["safety", "moderation", "growth", "content", "revenue", "lead"],
  analyst: ["safety", "moderation", "growth", "content", "revenue", "lead"],
  moderator: ["safety", "moderation"],
  partner_manager: ["lead", "revenue"],
};

async function gate() {
  const { requireAdminSession } = await import("./session.server");
  return requireAdminSession();
}

export const listBriefingItems = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ date: z.string().optional() }).parse(i))
  .handler(async ({ data }) => {
    const session = await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const cats = VISIBLE_CATEGORIES[session.role as Role] ?? [];

    let rows: AnyRow[] = [];
    if (cats.length) {
      const { data: list, error } = await supabaseAdmin
        .from("admin_briefings")
        .select("*")
        .eq("briefing_date", date)
        .in("category", cats)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      rows = (list ?? []) as AnyRow[];
    }

    // Annotate read flag for this admin
    const items = rows.map((r) => ({
      ...r,
      read: Array.isArray(r.read_by) && (r.read_by as string[]).includes(session.adminId),
    }));

    return { date, items, role: session.role };
  });

export const markBriefingRead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const session = await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: getErr } = await supabaseAdmin
      .from("admin_briefings").select("read_by").eq("id", data.id).maybeSingle();
    if (getErr) throw new Error(getErr.message);
    const current: string[] = Array.isArray((row as any)?.read_by) ? ((row as any).read_by as string[]) : [];
    if (!current.includes(session.adminId)) current.push(session.adminId);
    const { error: updErr } = await supabaseAdmin
      .from("admin_briefings").update({ read_by: current }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

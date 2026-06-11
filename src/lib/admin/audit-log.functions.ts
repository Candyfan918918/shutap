// Admin audit log: read mod_actions and stream CSV exports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AnyRow = Record<string, any>;

async function gate() {
  const { requireAdminSession } = await import("./session.server");
  return requireAdminSession({ roles: ["super_admin", "moderator", "analyst"] });
}

const ACTIONS = [
  "no_action",
  "warn_user",
  "remove_content",
  "suspend_7d",
  "ban",
  "escalate",
  "refer_to_legal",
] as const;

export const listModActions = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminId: z.string().uuid().optional(),
      action: z.enum(ACTIONS).optional(),
      entityType: z.string().min(1).max(40).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("mod_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.adminId) q = q.eq("admin_id", data.adminId);
    if (data.action) q = q.eq("action", data.action);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as AnyRow[] };
  });

export const listAdminUsersForFilter = createServerFn({ method: "GET" })
  .handler(async () => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id, display_name, email, role")
      .order("display_name");
    if (error) throw new Error(error.message);
    return { admins: (data ?? []) as AnyRow[] };
  });

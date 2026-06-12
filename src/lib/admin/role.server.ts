// Admin role assertion — call from inside server-fn handlers only.
// Queries the admin_users table (admin_role enum), NOT public.user_roles.
// The `adminId` argument is the admin_users.id from the admin cookie session,
// not the Supabase auth.users id (admin_users has no link to auth.users).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Roles considered "admin" for gating admin tooling.
// Matches the admin_role enum values that should pass assertAdmin().
export const ADMIN_ROLES = ["super_admin", "moderator"] as const satisfies readonly ("super_admin" | "moderator" | "analyst" | "partner_manager")[];
export type AdminGateRole = (typeof ADMIN_ROLES)[number];

export async function isAdmin(adminId: string | null | undefined): Promise<boolean> {
  if (!adminId) return false;
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("role, active")
    .eq("id", adminId)
    .in("role", [...ADMIN_ROLES])
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

export async function assertAdmin(adminId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, active")
    .eq("id", adminId)
    .in("role", [...ADMIN_ROLES])
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

// Schema health check — verifies the columns the onboarding flow depends on
// are present on the profiles table. Admin-only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REQUIRED_PROFILE_COLUMNS = [
  "id",
  "age_verified",
  "dob_month",
  "dob_year",
  "nationality",
  "emotion",
  "creature",
  "blocked_reason",
  "blocked_at",
] as const;

export type SchemaCheckResult = {
  ok: boolean;
  missing: string[];
  checked: string[];
  error?: string;
};

export const schemaCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchemaCheckResult> => {
    const { userId } = context;

    // gate to admin role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return { ok: false, missing: [], checked: [], error: "forbidden" };
    }

    const cols = REQUIRED_PROFILE_COLUMNS.join(", ");
    const { error } = await supabaseAdmin
      .from("profiles")
      .select(cols)
      .limit(1);

    if (error) {
      // Postgres "undefined column" hints — extract the column name(s) named in the message.
      const missing: string[] = [];
      for (const c of REQUIRED_PROFILE_COLUMNS) {
        if (error.message.includes(c)) missing.push(c);
      }
      return {
        ok: false,
        missing,
        checked: [...REQUIRED_PROFILE_COLUMNS],
        error: error.message,
      };
    }

    return { ok: true, missing: [], checked: [...REQUIRED_PROFILE_COLUMNS] };
  });

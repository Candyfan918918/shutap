// Centralized age gate. Chain after requireSupabaseAuth.
// Throws 'age_gate_required' if the profile is not age_verified.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireAgeVerified = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const ctx = context as { supabase: any; userId: string };
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("age_verified")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (error) throw new Error(`age_gate_lookup_failed: ${error.message}`);
    if (!data?.age_verified) throw new Error("age_gate_required");

    return next();
  });

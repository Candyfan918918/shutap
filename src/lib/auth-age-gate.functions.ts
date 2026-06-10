// Age gate: <18 → mark profile blocked + sign out (do NOT delete the auth user;
// that creates confusing OAuth re-auth behaviour). ≥18 → mark age_verified.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureProfile } from "@/lib/profile/bootstrap.server";

const makeInputSchema = () =>
  z.object({
    dob_month: z.number().int().min(1).max(12),
    dob_year: z.number().int().min(1900).max(new Date().getUTCFullYear()),
  });

export type AgeGateResult = {
  data: { age_verified: true } | null;
  error: string | null;
};

function ageYearsFrom(month: number, year: number): number {
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const m = now.getUTCMonth() + 1;
  if (m < month) age -= 1;
  return age;
}

export const verifyAge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => makeInputSchema().parse(input))
  .handler(async ({ data, context }): Promise<AgeGateResult> => {
    const ctx = context as { userId: string };
    const age = ageYearsFrom(data.dob_month, data.dob_year);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      await ensureProfile(ctx.userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "profile_bootstrap_failed";
      return { data: null, error: msg };
    }

    if (age < 18) {
      // Soft block — keep the auth user so we can refuse re-entry deterministically.
      const { error: blockError } = await supabaseAdmin
        .from("profiles")
        .update({
          blocked_reason: "underage",
          blocked_at: new Date().toISOString(),
          dob_month: data.dob_month,
          dob_year: data.dob_year,
        } as never)
        .eq("id", ctx.userId);
      if (blockError) return { data: null, error: blockError.message };

      // Revoke all sessions for this user — they can't sneak back in until appeal.
      try {
        await supabaseAdmin.auth.admin.signOut(ctx.userId);
      } catch {
        // best-effort; the profile flag is the source of truth
      }
      return { data: null, error: "age_gate_failed" };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        age_verified: true,
        dob_month: data.dob_month,
        dob_year: data.dob_year,
      } as never)
      .eq("id", ctx.userId);

    if (error) return { data: null, error: error.message };
    return { data: { age_verified: true }, error: null };
  });

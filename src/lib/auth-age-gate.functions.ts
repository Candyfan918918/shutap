// Age gate: <18 → delete auth user, 403. ≥18 → mark profile age_verified.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
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
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AgeGateResult> => {
    const ctx = context as { userId: string };
    const age = ageYearsFrom(data.dob_month, data.dob_year);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (profileLookupError) {
      return { data: null, error: profileLookupError.message };
    }

    if (!existingProfile) {
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
      if (authUserError) {
        return { data: null, error: authUserError.message };
      }

      const fallbackNickname = authUser.user.user_metadata?.full_name
        || authUser.user.user_metadata?.name
        || authUser.user.email
        || `user_${ctx.userId.slice(0, 8)}`;

      const { error: bootstrapError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: ctx.userId,
          email: authUser.user.email,
          handle: `user_${ctx.userId.replace(/-/g, "").slice(0, 12)}`,
          nickname: fallbackNickname,
          display_name: fallbackNickname,
          locale: "en",
        } as never);

      if (bootstrapError) {
        return { data: null, error: bootstrapError.message };
      }
    }

    if (age < 18) {
      // Spec: no retry — delete the auth user.
      await supabaseAdmin.auth.admin.deleteUser(ctx.userId);
      return { data: null, error: "age_gate_failed" };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        age_verified: true,
        dob_month: data.dob_month,
        dob_year: data.dob_year,
      })
      .eq("id", ctx.userId);

    if (error) return { data: null, error: error.message };
    return { data: { age_verified: true }, error: null };
  });

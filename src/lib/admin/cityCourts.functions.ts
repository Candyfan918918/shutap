// Admin tooling for city court toggles, caps and pause reasons.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { userId: string };

export interface CityCourtRow {
  code: string;
  label: string;
  countryCode: string | null;
  active: boolean;
  nominationCap: number;
  pausedReason: string | null;
  updatedAt: string;
}

export const listCityCourts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { assertAdmin } = await import("./role.server");
    await assertAdmin(ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("city_courts")
      .select("code, label, country_code, active, nomination_cap, paused_reason, updated_at")
      .order("country_code", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    const rows: CityCourtRow[] = (data ?? []).map((r: any) => ({
      code: r.code,
      label: r.label,
      countryCode: r.country_code ?? null,
      active: !!r.active,
      nominationCap: r.nomination_cap ?? 5,
      pausedReason: r.paused_reason ?? null,
      updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
    }));
    return { rows };
  });

export const toggleCityCourt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      code: z.string().min(1).max(16),
      active: z.boolean(),
      pausedReason: z.string().max(280).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { assertAdmin } = await import("./role.server");
    await assertAdmin(ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("city_courts")
      .update({
        active: data.active,
        paused_reason: data.active ? null : (data.pausedReason ?? "Paused by Bench"),
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCityCourtCap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      code: z.string().min(1).max(16),
      nominationCap: z.number().int().min(0).max(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { assertAdmin } = await import("./role.server");
    await assertAdmin(ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("city_courts")
      .update({
        nomination_cap: data.nominationCap,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

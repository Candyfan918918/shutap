// Identity server functions: finalize identity (auto-name + avatar) and read
// the current user's identity block.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveGeoFromRequest } from "@/lib/geo/resolve.server";
import { generateIdentity } from "@/lib/identity/generate-name";
import { generateAvatarSVG } from "@/lib/identity/generate-avatar";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

export interface IdentityPayload {
  userId: string;
  displayName: string;
  cityLabel: string;
  descriptor: string;
  vibe: string;
  avatarUrl: string;
  locale: Locale;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  ageVerified: boolean;
  nationality: string | null;
  emotion: string | null;
  creature: string | null;
  onboardedAt: string | null;
}

// Idempotent: re-roll is allowed; onboarded_at is only set the first time.
export const finalizeIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rerollSeed: z.string().max(64).optional(),
        preferredLocale: z.string().min(2).max(8).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<IdentityPayload> => {
    const { supabase, userId } = context;

    const { data: existing, error: getErr } = await supabase
      .from("profiles")
      .select("id, locale, country, country_code, city, region, display_name, avatar_url, vibe, descriptor, city_label, age_verified, nationality, emotion, creature, onboarded_at, nickname")
      .eq("id", userId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);

    const geo = resolveGeoFromRequest();

    const pickedLocale: Locale =
      (data.preferredLocale && isLocale(data.preferredLocale) && data.preferredLocale) ||
      (existing?.locale && isLocale(existing.locale) ? existing.locale : null) ||
      geo.locale ||
      DEFAULT_LOCALE;

    const countryCode =
      (existing?.country_code as string | null) ||
      geo.country ||
      (existing?.country as string | null) ||
      null;

    const cityFromGeo = geo.city;
    const region = (existing?.region as string | null) || geo.region;

    const seed = `${userId}:${data.rerollSeed ?? "v1"}`;
    const ident = generateIdentity({
      countryCode,
      locale: pickedLocale,
      seed,
    });
    // If we actually have a real city from geo and this is the first roll
    // (no rerollSeed) we prefer the real city label over the curated pool —
    // so a Paris IP sees "Paris · …" instead of a random French city.
    const cityLabel = !data.rerollSeed && cityFromGeo ? cityFromGeo : ident.cityLabel;
    const sep = pickedLocale === "zh" || pickedLocale === "ja" || pickedLocale === "ko" ? "·" : " · ";
    const displayName = cityLabel === ident.cityLabel
      ? ident.displayName
      : `${cityLabel}${sep}${ident.descriptor}`;

    const avatarUrl = generateAvatarSVG({
      vibe: ident.vibe,
      cityLabel,
      seed,
    });
    const createProfilePatch: Record<string, unknown> = existing?.id
      ? {}
      : {
          handle: `user_${userId.replace(/-/g, "").slice(0, 12)}`,
          nickname: displayName,
        };

    const patch: Record<string, unknown> = {
      display_name: displayName,
      avatar_url: avatarUrl,
      vibe: ident.vibe,
      descriptor: ident.descriptor,
      city_label: cityLabel,
      country_code: countryCode,
      country: countryCode, // keep legacy column in sync
      region,
      city: cityFromGeo ?? existing?.city ?? null,
      locale: pickedLocale,
      last_seen_at: new Date().toISOString(),
    };
    if (!existing?.onboarded_at) {
      patch.onboarded_at = new Date().toISOString();
    }

    const { data: row, error: updErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        ...createProfilePatch,
        ...patch,
      } as never, { onConflict: "id" })
      .select("id, display_name, avatar_url, vibe, descriptor, city_label, country_code, region, city, locale, age_verified, nationality, emotion, creature, onboarded_at")
      .single();
    if (updErr) throw new Error(updErr.message);

    return {
      userId,
      displayName: row.display_name ?? displayName,
      cityLabel: row.city_label ?? cityLabel,
      descriptor: row.descriptor ?? ident.descriptor,
      vibe: row.vibe ?? ident.vibe,
      avatarUrl: row.avatar_url ?? avatarUrl,
      locale: (isLocale(row.locale) ? row.locale : pickedLocale) as Locale,
      countryCode: (row.country_code as string | null) ?? countryCode,
      region: (row.region as string | null) ?? region,
      city: (row.city as string | null) ?? cityFromGeo,
      ageVerified: Boolean(row.age_verified),
      nationality: (row.nationality as string | null) ?? null,
      emotion: (row.emotion as string | null) ?? null,
      creature: (row.creature as string | null) ?? null,
      onboardedAt: (row.onboarded_at as string | null) ?? new Date().toISOString(),
    };
  });

export const getMyIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IdentityPayload | null> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, vibe, descriptor, city_label, country_code, region, city, locale, age_verified, nationality, emotion, creature, onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.display_name || !row.avatar_url) return null;

    // Touch last_seen_at; non-blocking failures are fine
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() } as never)
      .eq("id", userId);

    return {
      userId,
      displayName: row.display_name,
      cityLabel: (row.city_label as string | null) ?? "",
      descriptor: (row.descriptor as string | null) ?? "",
      vibe: (row.vibe as string | null) ?? "dreamy",
      avatarUrl: row.avatar_url,
      locale: (isLocale(row.locale) ? row.locale : DEFAULT_LOCALE) as Locale,
      countryCode: (row.country_code as string | null) ?? null,
      region: (row.region as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      ageVerified: Boolean(row.age_verified),
      nationality: (row.nationality as string | null) ?? null,
      emotion: (row.emotion as string | null) ?? null,
      creature: (row.creature as string | null) ?? null,
      onboardedAt: (row.onboarded_at as string | null) ?? null,
    };
  });

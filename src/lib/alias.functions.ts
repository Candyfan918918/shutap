// Alias generation + claim — the slot-machine identity ceremony.
// Pools are weighted by entry-case category + relationship type.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ── Pools ──────────────────────────────────────────────────────────

const EMOTION_POOLS: Record<string, string[]> = {
  heartbreak: ["Wistful", "Longing", "Tender", "Melancholy", "Heartbroken", "Forlorn", "Yearning"],
  drama: ["Furious", "Defiant", "Bold", "Fierce", "Reckless", "Vindictive", "Brazen", "Indignant"],
  wholesome: ["Hopeful", "Tender", "Grateful", "Serene", "Joyful", "Radiant", "Content"],
  workplace: ["Determined", "Conflicted", "Exhausted", "Restless", "Indignant", "Resolute"],
  family: ["Anguished", "Nostalgic", "Stubborn", "Wounded", "Possessive", "Forgiving"],
};

const FULL_EMOTION = Array.from(
  new Set(Object.values(EMOTION_POOLS).flat().concat(["Curious", "Quiet", "Restless"])),
);

const CREATURE_POOLS: Record<string, string[]> = {
  romantic: ["Albatross", "Crane", "Koi", "Seahorse", "Manta", "Swan", "Flamingo", "Hummingbird"],
  family: ["Monstera", "Baobab", "Fox", "Rabbit", "Otter", "Hedgehog", "Bamboo", "Lotus"],
  workplace: ["Mantis", "Cicada", "Bee", "Dragonfly", "Scarab", "Moth"],
  stranger: ["Pangolin", "Armadillo", "Raccoon", "Quokka", "Axolotl"],
};

const FULL_CREATURE = Array.from(new Set(Object.values(CREATURE_POOLS).flat()));

const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  US: "American", GB: "British", CA: "Canadian", AU: "Australian", FR: "French",
  DE: "German", ES: "Spanish", IT: "Italian", JP: "Japanese", KR: "Korean",
  CN: "Chinese", IN: "Indian", BR: "Brazilian", MX: "Mexican", NL: "Dutch",
  SE: "Swedish", ID: "Indonesian", PH: "Filipino", TR: "Turkish", AE: "Emirati",
  SG: "Singaporean", IE: "Irish", PT: "Portuguese", NO: "Norwegian", DK: "Danish",
  FI: "Finnish", PL: "Polish", GR: "Greek", AR: "Argentine", CL: "Chilean",
  CO: "Colombian", PE: "Peruvian", ZA: "South African", EG: "Egyptian", NG: "Nigerian",
  KE: "Kenyan", VN: "Vietnamese", TH: "Thai", MY: "Malaysian", NZ: "Kiwi",
};
const NATIONALITY_POOL = Array.from(new Set(Object.values(COUNTRY_TO_NATIONALITY)));

function pickEmotion(category?: string | null): string[] {
  const k = (category ?? "").toLowerCase();
  for (const key of Object.keys(EMOTION_POOLS)) {
    if (k.includes(key)) return EMOTION_POOLS[key];
  }
  return FULL_EMOTION;
}

function pickCreature(rel?: string | null): string[] {
  const k = (rel ?? "").toLowerCase();
  if (k.includes("ex") || k.includes("romant") || k.includes("partner") || k.includes("date")) return CREATURE_POOLS.romantic;
  if (k.includes("famil") || k.includes("parent") || k.includes("sibling") || k.includes("mom") || k.includes("dad")) return CREATURE_POOLS.family;
  if (k.includes("work") || k.includes("boss") || k.includes("colleag")) return CREATURE_POOLS.workplace;
  if (k.includes("strang") || k.includes("service") || k.includes("custom")) return CREATURE_POOLS.stranger;
  return FULL_CREATURE;
}

function pickNationality(country?: string | null): string {
  if (country && COUNTRY_TO_NATIONALITY[country.toUpperCase()]) {
    return COUNTRY_TO_NATIONALITY[country.toUpperCase()];
  }
  return NATIONALITY_POOL[Math.floor(Math.random() * NATIONALITY_POOL.length)];
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface GeneratedAlias {
  nationality: string;
  emotion: string;
  creature: string;
  reelPools: {
    nationality: string[];
    emotion: string[];
    creature: string[];
  };
}

export const generateAlias = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.string().max(64).optional(),
      relationshipType: z.string().max(64).optional(),
    }).parse,
  )
  .handler(async ({ data }): Promise<GeneratedAlias> => {
    const country =
      getRequestHeader("cf-ipcountry") ||
      getRequestHeader("x-vercel-ip-country") ||
      getRequestHeader("x-country") ||
      null;

    const emotionPool = pickEmotion(data.category);
    const creaturePool = pickCreature(data.relationshipType);
    const nationality = pickNationality(country);

    // Uniqueness — retry up to 5 times against existing claimed aliases.
    let chosen = { emotion: pick(emotionPool), creature: pick(creaturePool) };
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("nationality", nationality)
        .eq("emotion", chosen.emotion)
        .eq("creature", chosen.creature)
        .limit(1)
        .maybeSingle();
      if (!existing) break;
      chosen = { emotion: pick(emotionPool), creature: pick(creaturePool) };
    }

    return {
      nationality,
      emotion: chosen.emotion,
      creature: chosen.creature,
      reelPools: {
        nationality: NATIONALITY_POOL,
        emotion: emotionPool,
        creature: creaturePool,
      },
    };
  });

// ── Mock OTP — creates a real auth user from a phone via deterministic email
// (No SMS provider is wired; any 6-digit code is accepted.)

export const mockOtpVerify = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      phone: z.string().min(6).max(20).regex(/^\+?[0-9 \-]+$/),
      code: z.string().regex(/^[0-9]{6}$/),
    }).parse,
  )
  .handler(async ({ data }): Promise<{ email: string; password: string }> => {
    const normalized = data.phone.replace(/[^0-9]/g, "");
    const email = `phone-${normalized}@shutap-mock.local`;
    // Deterministic password derived from phone so re-login works.
    const password = `mock!${normalized}!shutap`;

    // Check if user already exists; if not, create.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const exists = (list?.users ?? []).some((u) => u.email === email);
    if (!exists) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { phone: data.phone, source: "mock_otp" },
      });
      if (error && !/already/i.test(error.message)) throw new Error(error.message);
    }
    return { email, password };
  });

// ── Age verification

export const verifyAge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse)
  .handler(async ({ data, context }): Promise<{ ok: true; ageOk: boolean }> => {
    const { supabase, userId } = context;
    const dobDate = new Date(data.dob);
    const now = new Date();
    let age = now.getUTCFullYear() - dobDate.getUTCFullYear();
    const m = now.getUTCMonth() - dobDate.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < dobDate.getUTCDate())) age--;
    const ageOk = age >= 18;
    const { error } = await supabase
      .from("profiles")
      .update({ dob: data.dob, age_verified: ageOk })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, ageOk };
  });

// ── Claim the alias (writes to profile)

export const claimAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nationality: z.string().min(2).max(40),
      emotion: z.string().min(2).max(40),
      creature: z.string().min(2).max(40),
      emoji: z.string().min(1).max(8),
      rerollUsed: z.boolean(),
      phone: z.string().min(6).max(20).optional(),
    }).parse,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const nickname = `${data.emotion} ${data.creature}`;
    const update: Record<string, unknown> = {
      nationality: data.nationality,
      emotion: data.emotion,
      creature: data.creature,
      emoji: data.emoji,
      reroll_used: data.rerollUsed,
      nickname,
    };
    if (data.phone) {
      update.phone = data.phone;
      update.phone_verified = true;
    }
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

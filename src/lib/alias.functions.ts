// Alias generation + claim — the slot-machine identity ceremony.
// Pools are weighted by entry-case category + relationship type.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      countryCode: z.string().length(2).optional(),
    }).parse,
  )
  .handler(async ({ data }): Promise<GeneratedAlias> => {
    const country =
      data.countryCode ||
      getRequestHeader("cf-ipcountry") ||
      getRequestHeader("x-vercel-ip-country") ||
      getRequestHeader("x-country") ||
      null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

// ── Claim the alias (writes to profile)
// Phone is intentionally NOT collected — Shutap auth is Email OTP + Google + Apple only.

export const claimAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nationality: z.string().min(2).max(40),
      emotion: z.string().min(2).max(40),
      creature: z.string().min(2).max(40),
      emoji: z.string().min(1).max(8),
      rerollUsed: z.boolean(),
    }).parse,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const nickname = `${data.emotion} ${data.nationality} ${data.creature}`;
    const update = {
      nationality: data.nationality,
      emotion: data.emotion,
      creature: data.creature,
      emoji: data.emoji,
      reroll_used: data.rerollUsed,
      nickname,
    };
    const { error } = await supabase
      .from("profiles")
      .update(update as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


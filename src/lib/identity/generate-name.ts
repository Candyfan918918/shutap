import type { Locale } from "@/lib/i18n";
import { pickCity } from "@/lib/identity/city-pools";
import { pickDescriptor, nameSeparator, type Descriptor, type Vibe } from "@/lib/identity/descriptor-pools";

export interface GeneratedIdentity {
  displayName: string;
  cityLabel: string;
  descriptor: string;
  vibe: Vibe;
}

// Stable hash → 32-bit unsigned int. Used so the same seed produces the same identity.
function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateIdentity(params: {
  countryCode: string | null | undefined;
  locale: Locale;
  seed: string;
}): GeneratedIdentity {
  const baseSeed = hash(params.seed);
  const citySeed = baseSeed;
  const descriptorSeed = hash(params.seed + ":d");

  const cityLabel = pickCity(params.countryCode, citySeed);
  const descriptor: Descriptor = pickDescriptor(params.locale, descriptorSeed);
  const displayName = `${cityLabel}${nameSeparator(params.locale)}${descriptor.text}`;

  return {
    displayName,
    cityLabel,
    descriptor: descriptor.text,
    vibe: descriptor.vibe,
  };
}

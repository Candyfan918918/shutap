// Descriptor pools per language. Each descriptor carries a "vibe" tag that
// drives avatar palette + UI accent. Vibes:
//   elegant | wild | soft | sharp | dreamy | royal | playful
import type { Locale } from "@/lib/i18n";

export type Vibe = "elegant" | "wild" | "soft" | "sharp" | "dreamy" | "royal" | "playful";

export interface Descriptor {
  text: string;
  vibe: Vibe;
}

export const DESCRIPTORS: Record<Locale, Descriptor[]> = {
  zh: [
    { text: "超模", vibe: "elegant" },
    { text: "秋花", vibe: "dreamy" },
    { text: "妮可基德曼", vibe: "royal" },
    { text: "莫妮卡贝鲁奇", vibe: "elegant" },
    { text: "尤物", vibe: "wild" },
    { text: "霸总", vibe: "sharp" },
    { text: "温柔野兽", vibe: "wild" },
    { text: "轻熟女王", vibe: "royal" },
    { text: "甜心暴击", vibe: "playful" },
    { text: "小恶魔", vibe: "playful" },
    { text: "初恋脸", vibe: "soft" },
    { text: "深夜诗人", vibe: "dreamy" },
  ],
  en: [
    { text: "Supermodel", vibe: "elegant" },
    { text: "Velvet Queen", vibe: "royal" },
    { text: "Midnight Muse", vibe: "dreamy" },
    { text: "Chic Goddess", vibe: "elegant" },
    { text: "Wild Beauty", vibe: "wild" },
    { text: "Soft Power", vibe: "soft" },
    { text: "Dream Girl", vibe: "dreamy" },
    { text: "CEO Energy", vibe: "sharp" },
    { text: "Heartbreaker", vibe: "wild" },
    { text: "Cosmic Sweetheart", vibe: "playful" },
    { text: "Quiet Chaos", vibe: "soft" },
    { text: "Plot Twist", vibe: "playful" },
  ],
  ja: [
    { text: "美人", vibe: "elegant" },
    { text: "夜桜", vibe: "dreamy" },
    { text: "女神", vibe: "royal" },
    { text: "クールビューティー", vibe: "sharp" },
    { text: "小悪魔", vibe: "playful" },
    { text: "甘えん坊", vibe: "soft" },
    { text: "恋の達人", vibe: "wild" },
  ],
  ko: [
    { text: "여신", vibe: "royal" },
    { text: "심쿵", vibe: "playful" },
    { text: "치명적", vibe: "wild" },
    { text: "달콤", vibe: "soft" },
    { text: "도시 미녀", vibe: "elegant" },
    { text: "밤하늘", vibe: "dreamy" },
    { text: "카리스마", vibe: "sharp" },
  ],
  es: [
    { text: "Reina Bella", vibe: "royal" },
    { text: "Dulce Tormenta", vibe: "wild" },
    { text: "Musa Nocturna", vibe: "dreamy" },
    { text: "Alma Salvaje", vibe: "wild" },
    { text: "Corazón Suave", vibe: "soft" },
    { text: "Jefa Total", vibe: "sharp" },
    { text: "Chispa Dorada", vibe: "playful" },
  ],
  pt: [
    { text: "Rainha do Drama", vibe: "royal" },
    { text: "Doce Tempestade", vibe: "wild" },
    { text: "Musa da Madrugada", vibe: "dreamy" },
    { text: "Alma Selvagem", vibe: "wild" },
    { text: "Coração Macio", vibe: "soft" },
    { text: "Chefona", vibe: "sharp" },
    { text: "Faísca", vibe: "playful" },
  ],
};

export function pickDescriptor(locale: Locale, seed: number): Descriptor {
  const pool = DESCRIPTORS[locale] ?? DESCRIPTORS.en;
  return pool[seed % pool.length];
}

// Locale-aware separator between city and descriptor
export function nameSeparator(locale: Locale): string {
  return locale === "zh" || locale === "ja" || locale === "ko" ? "·" : " · ";
}

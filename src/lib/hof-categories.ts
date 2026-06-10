// HOF categories — single source of truth.
// Applies to one or more entity types: story | case | user.

export type HofEntityType = "story" | "case" | "user";

export interface HofCategoryDef {
  key: string;
  label: string;
  emoji: string;
  appliesTo: HofEntityType[];
  benchLine: string; // template; "{entity}" placeholder allowed
}

export const HOF_CATEGORIES: HofCategoryDef[] = [
  { key: "most_dramatic",        label: "Most Dramatic",          emoji: "🔥", appliesTo: ["story", "case"], benchLine: "The room could not look away." },
  { key: "most_controversial",   label: "Most Controversial",     emoji: "⚖️", appliesTo: ["story", "case"], benchLine: "Split the bench down the middle." },
  { key: "most_relatable",       label: "Most Relatable",         emoji: "💚", appliesTo: ["story"],         benchLine: "Strangers nodded in unison." },
  { key: "most_surprising",      label: "Most Surprising Verdict",emoji: "🎉", appliesTo: ["case"],          benchLine: "Nobody saw it coming. Almost nobody." },
  { key: "most_shocking",        label: "Most Shocking Verdict",  emoji: "⚡", appliesTo: ["case"],          benchLine: "The verdict landed like a gavel." },
  { key: "most_shared",          label: "Most Shared",            emoji: "📤", appliesTo: ["story", "case"], benchLine: "Spread faster than a group chat." },
  { key: "biggest_red_flag",     label: "Biggest Red Flag",       emoji: "🚩", appliesTo: ["story", "case"], benchLine: "Red flag visible from orbit." },
  { key: "biggest_green_flag",   label: "Biggest Green Flag",     emoji: "🟢", appliesTo: ["story", "case"], benchLine: "Keep this one." },
  { key: "fastest_to_court",     label: "Fastest to Court",       emoji: "🏃", appliesTo: ["case"],          benchLine: "The room called the case before lunch." },
  { key: "most_accurate_predictor", label: "Most Accurate Predictor", emoji: "🎯", appliesTo: ["user"],     benchLine: "Called it before the gavel." },
  { key: "top_juror",            label: "Top Juror",              emoji: "👑", appliesTo: ["user"],          benchLine: "Showed up. Read. Voted. Repeat." },
  { key: "sharpest_steelman",    label: "Sharpest Steelman",      emoji: "🛡️", appliesTo: ["user"],          benchLine: "Argued the other side better than the other side." },
];

export const HOF_PERIODS = ["daily", "weekly", "monthly", "all"] as const;
export type HofPeriod = typeof HOF_PERIODS[number];

export function periodLabel(p: HofPeriod): string {
  return p === "daily" ? "Daily" : p === "weekly" ? "Weekly" : p === "monthly" ? "Monthly" : "All Time";
}

export function categoryByKey(key: string): HofCategoryDef | undefined {
  return HOF_CATEGORIES.find((c) => c.key === key);
}

export function periodKeyFor(p: HofPeriod, now = new Date()): string {
  if (p === "all") return "all";
  const y = now.getUTCFullYear();
  if (p === "daily") {
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (p === "monthly") {
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  // weekly (ISO)
  const onejan = Date.UTC(y, 0, 1);
  const week = Math.ceil(((now.getTime() - onejan) / 86400000 + 1) / 7);
  return `${y}-W${week}`;
}

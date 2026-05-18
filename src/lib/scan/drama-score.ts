// Marriage Drama Scan™ scoring engine.
// Given a complete answer map, returns total score (0-1000), per-subscore
// breakdown, category label, percentile, tags, and badges.
import { QUESTION_BANK } from "./question-bank";
import {
  bandForScore,
  type AnswerMap,
  type AnswerValue,
  type Category,
  type Question,
  type ScoreResult,
  type Subscores,
} from "./types";

const SUBSCORE_CAPS: Record<Category, number> = {
  plot_twists: 200,
  emotional: 200,
  financial: 150,
  family: 150,
  communication: 150,
  love_bonus: 0, // upper bound — actual range is [-200, 0]
  foundation: 50,
};

const LOVE_BONUS_FLOOR = -200;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function scoreQuestion(q: Question, value: AnswerValue | undefined): number {
  if (value === undefined || value === null) return 0;

  switch (q.type) {
    case "single":
    case "cards": {
      if (typeof value !== "string") return 0;
      const opt = q.base.options?.find((o) => o.id === value);
      const fromMap = q.scoreMap?.[value];
      const raw = fromMap ?? opt?.score ?? 0;
      // weight may be negative for "good" answers; we still respect cap on absolute side.
      return q.maxScore < 0
        ? Math.max(raw, q.maxScore)
        : clamp(raw, -q.maxScore, q.maxScore);
    }
    case "multi": {
      if (!Array.isArray(value)) return 0;
      let sum = 0;
      for (const v of value) {
        if (typeof v !== "string") continue;
        const opt = q.base.options?.find((o) => o.id === v);
        const fromMap = q.scoreMap?.[v];
        sum += fromMap ?? opt?.score ?? 0;
      }
      return clamp(sum, -q.maxScore, q.maxScore);
    }
    case "slider":
    case "emoji_scale": {
      if (typeof value !== "number") return 0;
      // Normalize 0..100 → 0..1
      const norm = clamp(value, 0, 100) / 100;
      const weight = q.weight ?? q.maxScore;
      // For "good" axes (weight negative), invert: high value = good = score reduction.
      // For "bad" axes (weight positive), high value = more drama = positive contribution.
      const raw = norm * weight;
      // Cap by sign-matched bound
      if (weight >= 0) return clamp(raw, 0, q.maxScore);
      return clamp(raw, -q.maxScore, 0);
    }
    case "text":
      return 0;
  }
}

function collectTags(q: Question, value: AnswerValue | undefined): string[] {
  const tags: string[] = [];
  if (q.staticTags) tags.push(...q.staticTags);
  if (value === undefined || value === null) return tags;
  if (q.type === "single" || q.type === "cards") {
    if (typeof value === "string") {
      const opt = q.base.options?.find((o) => o.id === value);
      if (opt?.tag) tags.push(opt.tag);
    }
  } else if (q.type === "multi" && Array.isArray(value)) {
    for (const v of value) {
      if (typeof v !== "string") continue;
      const opt = q.base.options?.find((o) => o.id === v);
      if (opt?.tag) tags.push(opt.tag);
    }
  }
  return tags;
}

export function calculateDramaScore(answers: AnswerMap): ScoreResult {
  const subscores: Subscores = {
    plot_twists: 0,
    emotional: 0,
    financial: 0,
    family: 0,
    communication: 0,
    love_bonus: 0,
    foundation: 0,
  };
  const tagSet = new Set<string>();

  for (const q of QUESTION_BANK) {
    const value = answers[q.id];
    const points = scoreQuestion(q, value);
    if (q.category === "love_bonus") {
      // love_bonus questions yield negative scores; accumulate as negative.
      subscores.love_bonus += points;
    } else {
      subscores[q.category] += points;
    }
    for (const t of collectTags(q, value)) tagSet.add(t);
  }

  // Clamp each subscore to its band
  (Object.keys(subscores) as Category[]).forEach((k) => {
    if (k === "love_bonus") {
      subscores[k] = clamp(subscores[k], LOVE_BONUS_FLOOR, 0);
    } else {
      subscores[k] = clamp(subscores[k], 0, SUBSCORE_CAPS[k]);
    }
  });

  const total = clamp(
    subscores.plot_twists +
      subscores.emotional +
      subscores.financial +
      subscores.family +
      subscores.communication +
      subscores.love_bonus +
      subscores.foundation,
    0,
    1000,
  );

  const band = bandForScore(total);
  const badges = deriveBadges(subscores, total);
  const percentile = deterministicPercentile(total);

  return {
    totalScore: Math.round(total),
    subscores,
    category: band.label,
    categoryKey: band.key,
    percentile,
    tags: Array.from(tagSet),
    badges,
  };
}

function deriveBadges(s: Subscores, total: number): string[] {
  const badges: string[] = [];
  if (s.plot_twists >= 140) badges.push("Plot Twist Royalty 👑");
  else if (s.plot_twists >= 80) badges.push("Plot Twist Detected 🎭");
  if (s.emotional >= 140) badges.push("Emotional Damage Olympics 🥇");
  else if (s.emotional >= 80) badges.push("Heart Needs a Nap 💔");
  if (s.financial >= 100) badges.push("Wallet Needs Therapy 💸");
  if (s.family >= 110) badges.push("In-Laws Are a Character 👵");
  if (s.communication >= 110) badges.push("Silent Treatment Black Belt 🥋");
  if (s.love_bonus <= -120) badges.push("Still Romantic Somehow ❤️");
  if (total >= 900) badges.push("Legendary Chaos 🌋");
  else if (total <= 200) badges.push("Suspiciously Functional 🌿");
  if (badges.length === 0) badges.push("Marriage Survivor 🛟");
  return badges.slice(0, 5);
}

/**
 * Deterministic placeholder percentile that maps score → 0-99 in a slightly
 * curved way so the result page can show "higher than X% of marriages".
 * Real percentile (from DB aggregate) is a follow-up.
 */
function deterministicPercentile(total: number): number {
  const norm = clamp(total / 1000, 0, 1);
  // S-curve-ish: people cluster in 30-60 percentile
  const curved = 0.5 * (1 - Math.cos(norm * Math.PI));
  return Math.round(clamp(curved * 99, 0, 99));
}

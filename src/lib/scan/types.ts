// Shared types for the Shutap Relationship Scan engine.
// Safe to import from both client and server.

export type ScanLocale = "en" | "zh" | "es" | "pt" | "ja" | "ko";

export type Category =
  | "foundation"
  | "plot_twists"
  | "emotional"
  | "communication"
  | "financial"
  | "family"
  | "love_bonus";

export type QuestionType =
  | "single" // single-select option cards
  | "multi" // multi-select chips
  | "slider" // 0..100 emotional slider
  | "emoji_scale" // 1..5 emoji row
  | "cards" // visual large card picker (same shape as single but bigger UI)
  | "text"; // free-form, NOT scored

export type AnswerValue = string | string[] | number;

export type AnswerMap = Record<string, AnswerValue>;

export interface QuestionOption {
  id: string;
  label: string;
  emoji?: string;
  /** Per-option score contribution to the question's category subscore. */
  score?: number;
  /** Optional tag generated when this option is picked. */
  tag?: string;
}

export interface LocalizedQuestionStrings {
  title: string;
  subtitle?: string;
  helper?: string;
  options?: QuestionOption[];
  /** For slider: labels at both ends. */
  minLabel?: string;
  maxLabel?: string;
}

export interface ConditionalRule {
  /** Show this question only if ALL of the predicates pass. */
  showIf?: Predicate;
  /** Skip if ANY predicate matches (takes precedence over showIf). */
  hideIf?: Predicate;
}

export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { q: string; eq: AnswerValue }
  | { q: string; in: AnswerValue[] }
  | { q: string; includes: string }
  | { q: string; gt: number }
  | { q: string; lt: number }
  | { q: string; exists: true };

export interface Question {
  id: string;
  category: Category;
  type: QuestionType;
  /** Per-question cap on the score contributed (clamped after scoreMap). */
  maxScore: number;
  /** For slider/emoji: weight applied to normalized 0..1 value. */
  weight?: number;
  /**
   * For multi: per-option points (overridden by option.score if present).
   * Same shape works as a fallback for single/cards if you want to override
   * the option-level scores from one place.
   */
  scoreMap?: Record<string, number>;
  /** Tags forced on regardless of answer (e.g. "kids"). */
  staticTags?: string[];
  conditional?: ConditionalRule;
  /** Default i18n strings (en). Other locales fall back to en. */
  base: LocalizedQuestionStrings;
  /** Optional per-locale overrides. */
  i18n?: Partial<Record<ScanLocale, LocalizedQuestionStrings>>;
}

export interface Subscores {
  plot_twists: number;
  emotional: number;
  financial: number;
  family: number;
  communication: number;
  love_bonus: number; // -200..0
  foundation: number; // small contribution only
}

export interface ScoreResult {
  totalScore: number;
  subscores: Subscores;
  category: string;
  categoryKey: CategoryKey;
  percentile: number;
  tags: string[];
  badges: string[];
}

export type CategoryKey =
  | "disney"
  | "functional"
  | "snacks_therapy"
  | "netflix"
  | "courtroom"
  | "legendary";

export interface CategoryBand {
  key: CategoryKey;
  min: number;
  max: number;
  label: string;
  emoji: string;
  /** Short funny commentary line for the reveal screen. */
  commentary: string;
}

export const CATEGORY_BANDS: CategoryBand[] = [
  { key: "disney", min: 0, max: 149, label: "Disney Marriage™", emoji: "🏰", commentary: "Honestly? Suspicious levels of healthy." },
  { key: "functional", min: 150, max: 299, label: "Mostly Functional™", emoji: "🌿", commentary: "Some chaos. Manageable chaos." },
  { key: "snacks_therapy", min: 300, max: 499, label: "Needs Snacks & Therapy™", emoji: "🍿", commentary: "You're surviving. Beautifully." },
  { key: "netflix", min: 500, max: 699, label: "Netflix Original™", emoji: "🎬", commentary: "Your marriage has 4 seasons and a spinoff." },
  { key: "courtroom", min: 700, max: 899, label: "Courtroom Season™", emoji: "⚖️", commentary: "Apparently your relationship has subpoenas." },
  { key: "legendary", min: 900, max: 1000, label: "Legendary Chaos™", emoji: "🌋", commentary: "Marriage historians will study you." },
];

export function bandForScore(score: number): CategoryBand {
  return CATEGORY_BANDS.find((b) => score >= b.min && score <= b.max) ?? CATEGORY_BANDS[2];
}

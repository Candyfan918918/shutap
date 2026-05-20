// Question flow engine: ordering, conditional skipping, dynamic injection,
// and progress helpers. Pure functions only — safe to use on client + server.
import { QUESTION_BANK, getQuestion } from "./question-bank";
import type {
  AnswerMap,
  AnswerValue,
  LocalizedQuestionStrings,
  Predicate,
  Question,
  ScanLocale,
} from "./types";

const BASE_ORDER: string[] = [
  // Foundation first to drive conditional logic
  "marriage_status",
  "years_together",
  "has_kids",
  // Communication & emotional core
  "conflict_style",
  "resolution",
  "read_receipts",
  "emotional_safety",
  "trust_level",
  "loneliness",
  "crying_frequency",
  // Plot twists
  "cheating",
  "secret_phone",
  "divorce_threats",
  "ghosting_moment",
  // Financial
  "money_fights",
  "hidden_debt",
  "joint_finances",
  // Family
  "in_laws",
  "family_interference",
  "parenting_conflict",
  // Love bonus
  "affection",
  "humor",
  "kindness",
  "would_choose_again",
  // Healing (only injected when emotional damage is high — see logic below)
  "healing_question",
  // Open text last (optional)
  "biggest_plot_twist",
];

export function getInitialFlow(): string[] {
  return BASE_ORDER.filter((id) => getQuestion(id));
}

export function evaluatePredicate(p: Predicate, answers: AnswerMap): boolean {
  if ("all" in p) return p.all.every((sub) => evaluatePredicate(sub, answers));
  if ("any" in p) return p.any.some((sub) => evaluatePredicate(sub, answers));
  const a = answers[p.q];
  if ("exists" in p) return a !== undefined && a !== null && a !== "";
  if (a === undefined || a === null) return false;
  if ("eq" in p) return a === p.eq;
  if ("in" in p) return p.in.includes(a as AnswerValue);
  if ("includes" in p) return Array.isArray(a) && a.includes(p.includes);
  if ("gt" in p) return typeof a === "number" && a > p.gt;
  if ("lt" in p) return typeof a === "number" && a < p.lt;
  return false;
}

export function isQuestionVisible(q: Question, answers: AnswerMap): boolean {
  const c = q.conditional;
  if (!c) return true;
  if (c.hideIf && evaluatePredicate(c.hideIf, answers)) return false;
  if (c.showIf && !evaluatePredicate(c.showIf, answers)) return false;
  return true;
}

/**
 * Compute the live ordered path of questions the user will actually see,
 * given their current answers. Order follows BASE_ORDER, but invisible
 * questions are filtered out. This is recomputed on every answer save so the
 * flow stays adaptive.
 */
export function computeFlowPath(answers: AnswerMap): string[] {
  return getInitialFlow().filter((id) => {
    const q = getQuestion(id);
    return !!q && isQuestionVisible(q, answers);
  });
}

// -------- Adaptive re-ranking --------
// When a user answers a high-signal question, bump related follow-ups so the
// scan "digs deeper" into the live thread instead of marching through a static
// list. Already-answered questions stay frozen in the order they were taken.
type BoostRule = {
  when: (answers: AnswerMap) => boolean;
  boost: string[];
};

const BOOST_RULES: BoostRule[] = [
  {
    when: (a) => {
      const v = a["cheating"];
      return typeof v === "string" && v !== "" && v !== "no" && v !== "never";
    },
    boost: ["secret_phone", "ghosting_moment", "trust_level", "divorce_threats", "emotional_safety"],
  },
  {
    when: (a) => typeof a["trust_level"] === "number" && (a["trust_level"] as number) < 40,
    boost: ["cheating", "secret_phone", "emotional_safety", "loneliness"],
  },
  {
    when: (a) => {
      const v = a["money_fights"];
      return typeof v === "string" && ["often", "always", "weekly", "constant"].includes(v);
    },
    boost: ["hidden_debt", "joint_finances"],
  },
  {
    when: (a) => {
      const v = a["in_laws"];
      return typeof v === "string" && ["nightmare", "toxic", "bad", "interfering"].includes(v);
    },
    boost: ["family_interference", "parenting_conflict"],
  },
  {
    when: (a) => {
      const v = a["conflict_style"];
      return typeof v === "string" && ["explosive", "avoidant", "silent", "stonewall"].includes(v);
    },
    boost: ["resolution", "emotional_safety", "crying_frequency"],
  },
  {
    when: (a) => typeof a["emotional_safety"] === "number" && (a["emotional_safety"] as number) < 40,
    boost: ["loneliness", "crying_frequency", "would_choose_again", "healing_question"],
  },
  {
    when: (a) => {
      const v = a["crying_frequency"];
      return typeof v === "string" && ["weekly", "daily", "often"].includes(v);
    },
    boost: ["healing_question", "loneliness", "emotional_safety"],
  },
];

/**
 * Adaptive flow: answered questions keep their historical order; unanswered
 * questions are reshuffled so same-category follow-ups to the LAST answered
 * question and rule-boosted follow-ups come first.
 */
export function computeAdaptiveFlow(
  answers: AnswerMap,
  lastAnsweredId?: string,
): string[] {
  const base = computeFlowPath(answers);
  const answered = new Set(Object.keys(answers));
  const answeredInOrder = base.filter((id) => answered.has(id));
  const remaining = base.filter((id) => !answered.has(id));
  if (remaining.length === 0) return answeredInOrder;

  const boost = new Set<string>();
  for (const rule of BOOST_RULES) {
    if (rule.when(answers)) rule.boost.forEach((id) => boost.add(id));
  }
  if (lastAnsweredId) {
    const lastQ = getQuestion(lastAnsweredId);
    if (lastQ) {
      for (const id of remaining) {
        const q = getQuestion(id);
        if (q && q.category === lastQ.category) boost.add(id);
      }
    }
  }
  for (const id of answered) boost.delete(id);

  const priority = remaining.filter((id) => boost.has(id));
  const rest = remaining.filter((id) => !boost.has(id));
  return [...answeredInOrder, ...priority, ...rest];
}

export interface NextQuestionResult {
  nextId: string | null;
  nextIndex: number; // -1 when done
  total: number;
}

export function nextQuestionAfter(
  answeredId: string,
  answers: AnswerMap,
): NextQuestionResult {
  const path = computeAdaptiveFlow(answers, answeredId);
  const idx = path.indexOf(answeredId);
  const next = idx >= 0 && idx + 1 < path.length ? path[idx + 1] : null;
  return { nextId: next, nextIndex: next ? idx + 1 : -1, total: path.length };
}

export function questionByStep(step: number, answers: AnswerMap): Question | null {
  const path = computeFlowPath(answers);
  const id = path[step];
  if (!id) return null;
  return getQuestion(id) ?? null;
}

export function questionByStepFromPath(step: number, path: string[]): Question | null {
  const id = path[step];
  if (!id) return null;
  return getQuestion(id) ?? null;
}

export interface ProgressInfo {
  step: number;
  total: number;
  percent: number;
  etaSeconds: number;
}

export function progressInfo(step: number, answers: AnswerMap): ProgressInfo {
  const total = computeFlowPath(answers).length || BASE_ORDER.length;
  const safeStep = Math.min(Math.max(step, 0), total);
  const remaining = Math.max(total - safeStep, 0);
  return {
    step: safeStep,
    total,
    percent: total === 0 ? 0 : Math.round((safeStep / total) * 100),
    etaSeconds: remaining * 6, // ~6s per question average
  };
}

export function localizedStrings(
  q: Question,
  locale: ScanLocale,
): LocalizedQuestionStrings {
  return q.i18n?.[locale] ?? q.base;
}

export function isAnswerProvided(value: AnswerValue | undefined | null, q: Question): boolean {
  if (value === undefined || value === null) return q.type === "text"; // text is optional
  if (q.type === "multi") return Array.isArray(value) && value.length > 0;
  if (q.type === "text") return true; // text is always allowed to be skipped
  if (typeof value === "string") return value.length > 0;
  return true;
}

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

export interface NextQuestionResult {
  nextId: string | null;
  nextIndex: number; // -1 when done
  total: number;
}

export function nextQuestionAfter(
  answeredId: string,
  answers: AnswerMap,
): NextQuestionResult {
  const path = computeFlowPath(answers);
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

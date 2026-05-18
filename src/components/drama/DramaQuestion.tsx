// One question, full-screen, mobile-first.
// Renders the right input based on question.type. Tap-to-advance for single
// and emoji_scale; explicit "Continue" for multi/slider/text.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnswerValue, Question, ScanLocale } from "@/lib/scan/types";
import { localizedStrings, isAnswerProvided } from "@/lib/scan/question-engine";

interface Props {
  question: Question;
  initialAnswer?: AnswerValue;
  locale: ScanLocale;
  onSubmit: (value: AnswerValue | null) => void;
  saving?: boolean;
}

export function DramaQuestion({ question, initialAnswer, locale, onSubmit, saving }: Props) {
  const strings = localizedStrings(question, locale);
  const [value, setValue] = useState<AnswerValue | null>(
    initialAnswer === undefined ? defaultValue(question) : initialAnswer,
  );

  // Reset when navigating to a different question
  useEffect(() => {
    setValue(initialAnswer === undefined ? defaultValue(question) : initialAnswer);
  }, [question.id, initialAnswer]);

  const submit = (v: AnswerValue | null) => {
    if (saving) return;
    onSubmit(v);
  };

  const canContinue = question.type === "text" ? true : isAnswerProvided(value ?? undefined, question);

  return (
    <div className="mx-auto max-w-xl px-4 pt-8 pb-32">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            {labelForCategory(question.category, locale)}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-balance">
            {strings.title}
          </h1>
          {strings.subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{strings.subtitle}</p>
          )}

          <div className="mt-6">
            {question.type === "single" || question.type === "cards" ? (
              <OptionList
                options={strings.options ?? question.base.options ?? []}
                value={typeof value === "string" ? value : null}
                onPick={(id) => {
                  setValue(id);
                  submit(id);
                }}
                big={question.type === "cards"}
              />
            ) : question.type === "multi" ? (
              <MultiList
                options={strings.options ?? question.base.options ?? []}
                value={Array.isArray(value) ? value : []}
                onChange={setValue}
              />
            ) : question.type === "slider" || question.type === "emoji_scale" ? (
              <EmojiScale
                value={typeof value === "number" ? value : 50}
                minLabel={strings.minLabel ?? "Low"}
                maxLabel={strings.maxLabel ?? "High"}
                onChange={setValue}
              />
            ) : question.type === "text" ? (
              <TextInput
                value={typeof value === "string" ? value : ""}
                placeholder={strings.helper}
                onChange={setValue}
              />
            ) : null}
          </div>

          {(question.type === "multi" ||
            question.type === "slider" ||
            question.type === "emoji_scale" ||
            question.type === "text") && (
            <div className="mt-8">
              <button
                onClick={() => submit(value)}
                disabled={saving || (!canContinue && question.type !== "text")}
                className="w-full px-6 py-4 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base disabled:opacity-50 shadow-lg"
              >
                {saving ? "…" : question.type === "text" && !value ? "Skip" : "Continue →"}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function defaultValue(q: Question): AnswerValue | null {
  if (q.type === "multi") return [];
  if (q.type === "slider" || q.type === "emoji_scale") return 50;
  if (q.type === "text") return "";
  return null;
}

function OptionList({
  options,
  value,
  onPick,
  big,
}: {
  options: { id: string; label: string; emoji?: string }[];
  value: string | null;
  onPick: (id: string) => void;
  big?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${big ? "grid-cols-1" : "grid-cols-1"}`}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onPick(opt.id)}
            className={`text-left rounded-2xl border px-5 py-4 transition-all touch-manipulation ${
              selected
                ? "border-primary bg-primary/10 shadow-md scale-[1.01]"
                : "border-border bg-surface-elevated hover:border-primary/40 active:scale-[0.99]"
            } ${big ? "min-h-[80px] text-lg" : "text-base"}`}
          >
            {opt.emoji && <span className="mr-2">{opt.emoji}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiList({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; emoji?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = value.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`px-4 py-2.5 rounded-full border text-sm transition-all ${
              on
                ? "border-primary bg-primary/15 text-primary font-medium"
                : "border-border bg-surface-elevated text-muted-foreground hover:border-primary/40"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const EMOJIS = ["😌", "🙂", "😐", "😬", "🥲", "😭"];

function EmojiScale({
  value,
  minLabel,
  maxLabel,
  onChange,
}: {
  value: number;
  minLabel: string;
  maxLabel: string;
  onChange: (v: number) => void;
}) {
  const bucket = Math.min(EMOJIS.length - 1, Math.floor((value / 100) * EMOJIS.length));
  return (
    <div className="space-y-6">
      <div className="text-7xl text-center select-none">{EMOJIS[bucket]}</div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span className="tabular-nums">{value}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 240))}
      placeholder={placeholder ?? "Spill it…"}
      rows={4}
      className="w-full bg-surface-elevated border border-border rounded-2xl p-4 text-base resize-none focus:outline-none focus:border-primary/60"
    />
  );
}

const CATEGORY_LABELS_EN: Record<string, string> = {
  foundation: "Foundation",
  plot_twists: "Plot Twists",
  emotional: "Emotional",
  communication: "Communication",
  financial: "Financial",
  family: "Family",
  love_bonus: "Love Bonus ❤️",
};
const CATEGORY_LABELS_ZH: Record<string, string> = {
  foundation: "基础",
  plot_twists: "剧情反转",
  emotional: "情感",
  communication: "沟通",
  financial: "财务",
  family: "家庭",
  love_bonus: "甜蜜加分 ❤️",
};

function labelForCategory(c: string, locale: ScanLocale): string {
  const map = locale === "zh" ? CATEGORY_LABELS_ZH : CATEGORY_LABELS_EN;
  return map[c] ?? c;
}

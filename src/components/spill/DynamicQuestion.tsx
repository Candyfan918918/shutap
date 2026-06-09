import { useState } from "react";
import { motion } from "framer-motion";
import type { AiQuestion } from "@/lib/spill/types";

export function DynamicQuestion({
  question,
  disabled,
  onAnswer,
}: {
  question: AiQuestion;
  disabled?: boolean;
  onAnswer: (text: string) => void;
}) {
  if (question.type === "tap") {
    return (
      <div className="flex flex-col gap-2">
        {question.options.map((o) => (
          <motion.button
            key={o.id}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
            onClick={() => onAnswer(o.label)}
            className="text-left px-4 py-3 rounded-2xl bg-surface-elevated border border-border text-sm leading-snug hover:border-primary/60 disabled:opacity-50 transition"
          >
            {o.label}
          </motion.button>
        ))}
      </div>
    );
  }
  if (question.type === "multi") {
    return <MultiPicker question={question} disabled={disabled} onAnswer={onAnswer} />;
  }
  if (question.type === "slider") {
    return <SliderPicker question={question} disabled={disabled} onAnswer={onAnswer} />;
  }
  return null; // text — handled by the main composer textarea
}

function MultiPicker({
  question,
  disabled,
  onAnswer,
}: {
  question: Extract<AiQuestion, { type: "multi" }>;
  disabled?: boolean;
  onAnswer: (text: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {question.options.map((o) => {
          const on = picked.has(o.id);
          return (
            <button
              key={o.id}
              disabled={disabled}
              onClick={() => toggle(o.id)}
              className={`text-left px-4 py-3 rounded-2xl border text-sm leading-snug transition ${
                on
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-surface-elevated border-border hover:border-primary/40"
              }`}
            >
              <span className="mr-1">{on ? "✓" : "○"}</span> {o.label}
            </button>
          );
        })}
      </div>
      <button
        disabled={disabled || picked.size === 0}
        onClick={() => {
          const labels = question.options
            .filter((o) => picked.has(o.id))
            .map((o) => o.label);
          onAnswer(labels.join(" • "));
        }}
        className="w-full mt-1 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
      >
        Send →
      </button>
    </div>
  );
}

function SliderPicker({
  question,
  disabled,
  onAnswer,
}: {
  question: Extract<AiQuestion, { type: "slider" }>;
  disabled?: boolean;
  onAnswer: (text: string) => void;
}) {
  const min = question.min ?? 0;
  const max = question.max ?? 100;
  const [val, setVal] = useState(Math.round((min + max) / 2));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{question.minLabel ?? "low"}</span>
        <span className="text-foreground font-medium text-base tabular-nums">{val}</span>
        <span>{question.maxLabel ?? "high"}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        disabled={disabled}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <button
        disabled={disabled}
        onClick={() => onAnswer(`${val}/100`)}
        className="w-full py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
      >
        That's me →
      </button>
    </div>
  );
}

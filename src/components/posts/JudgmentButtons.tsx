// JudgmentButtons — 2×2 grid below the verdict bar. Local state only
// (persistence requires a `post_judgment_votes` table — Phase 4).
import { useState } from "react";

const JUDGMENTS = [
  { id: "not_guilty", label: "Not Guilty", emoji: "🕊️" },
  { id: "guilty", label: "Guilty", emoji: "⚖️" },
  { id: "mixed", label: "Mixed", emoji: "🌗" },
  { id: "more_info", label: "Need More Info", emoji: "🔎" },
] as const;

type JudgmentId = (typeof JUDGMENTS)[number]["id"];

interface Props {
  onCast?: (id: JudgmentId) => void;
}

export function JudgmentButtons({ onCast }: Props) {
  const [picked, setPicked] = useState<JudgmentId | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium mb-3" style={{ color: "var(--c-text-2)" }}>
        Cast your judgment
      </p>
      <div className="grid grid-cols-2 gap-2">
        {JUDGMENTS.map((j) => {
          const active = picked === j.id;
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => {
                const next = active ? null : j.id;
                setPicked(next);
                if (next) onCast?.(next);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition active:scale-[0.98] border ${
                active
                  ? "bg-primary text-primary-foreground border-primary outline outline-1 outline-white/80"
                  : "bg-surface-elevated border-border hover:border-primary/50"
              }`}
            >
              <span className="mr-1.5" aria-hidden>{j.emoji}</span>
              {j.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

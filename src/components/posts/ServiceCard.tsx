// ServiceCard — qualified service nudge (therapy/legal/mediation/financial).
// Renders nothing if no tag qualifies.
interface Props {
  tags?: string[] | null;
}

const MAP: Record<string, { icon: string; title: string; body: string }> = {
  therapy_signal: {
    icon: "🛋️",
    title: "Talk to someone trained",
    body: "Therapists who handle cases like this one. Free first call.",
  },
  legal_flag: {
    icon: "⚖️",
    title: "Speak to a lawyer",
    body: "Pre-vetted lawyers familiar with this category.",
  },
  mediation_signal: {
    icon: "🤝",
    title: "Try mediation first",
    body: "Cheaper than court, faster than silence.",
  },
  financial_advice_signal: {
    icon: "💸",
    title: "Get financial counsel",
    body: "Untangle the money before it untangles you.",
  },
};

export function ServiceCard({ tags }: Props) {
  if (!tags?.length) return null;
  const hit = tags.find((t) => MAP[t]);
  if (!hit) return null;
  const item = MAP[hit];
  return (
    <div
      className="rounded-2xl border p-4 flex items-start gap-3"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}
    >
      <span className="text-2xl shrink-0" aria-hidden>{item.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--c-text-2)" }}>{item.body}</p>
      </div>
      <button
        type="button"
        className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
      >
        See
      </button>
    </div>
  );
}

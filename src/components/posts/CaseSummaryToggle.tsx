// CaseSummaryToggle — "See case summary" collapsible. Renders facts,
// timeline, and key players if the post carries case_summary; otherwise hides.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface CaseSummary {
  facts?: string[];
  timeline?: { sequence?: number; event: string }[];
  key_players?: { role: string; description: string }[];
}

interface Props {
  summary?: CaseSummary | null;
}

export function CaseSummaryToggle({ summary }: Props) {
  const [open, setOpen] = useState(false);
  if (!summary) return null;
  const { facts, timeline, key_players } = summary;
  if (!facts?.length && !timeline?.length && !key_players?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium">See case summary</span>
        <span className="text-xs" style={{ color: "var(--c-text-3)" }}>{open ? "−" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 space-y-4 text-sm"
          >
            {facts?.length ? (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--c-text-3)" }}>Facts</p>
                <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--c-text-2)" }}>
                  {facts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ) : null}
            {timeline?.length ? (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--c-text-3)" }}>Timeline</p>
                <ol className="list-decimal pl-5 space-y-1" style={{ color: "var(--c-text-2)" }}>
                  {timeline.map((t, i) => <li key={i}>{t.event}</li>)}
                </ol>
              </div>
            ) : null}
            {key_players?.length ? (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--c-text-3)" }}>Key players</p>
                <ul className="space-y-1" style={{ color: "var(--c-text-2)" }}>
                  {key_players.map((p, i) => (
                    <li key={i}><span className="font-medium">{p.role}:</span> {p.description}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// SteelmanCard — "The Bench wonders" collapsible. Renders nothing unless
// `hasSteelman` is true and `body` is non-empty (graceful when column absent).
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  hasSteelman?: boolean | null;
  body?: string | null;
}

export function SteelmanCard({ hasSteelman, body }: Props) {
  const [open, setOpen] = useState(false);
  if (!hasSteelman || !body) return null;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium">The Bench wonders…</span>
        <span className="text-xs" style={{ color: "var(--c-text-3)" }}>{open ? "−" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 text-sm leading-relaxed"
            style={{ color: "var(--c-text-2)" }}
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

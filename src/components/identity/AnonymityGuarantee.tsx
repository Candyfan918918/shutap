import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GUARANTEES = [
  "Your real name is never shown",
  "Phone, email, and addresses are auto-removed",
  "Your handle is a randomly generated alias",
  "You can delete your story at any time",
  "We never sell your data",
];

export function AnonymityGuarantee({ variant = "pill" }: { variant?: "pill" | "inline" | "tooltip" }) {
  const [open, setOpen] = useState(false);

  const pill = (
    <button
      onClick={() => setOpen((v) => !v)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-elevated text-[11px] text-muted-foreground hover:text-foreground transition"
      aria-expanded={open}
    >
      <span aria-hidden>🔒</span>
      <span>Your story is posted anonymously</span>
      <span className="text-[10px] opacity-60">{open ? "▲" : "▼"}</span>
    </button>
  );

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="mt-2 rounded-xl border border-border bg-surface-elevated p-3 space-y-1.5">
            {GUARANTEES.map((g) => (
              <div key={g} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 text-primary" aria-hidden>✓</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (variant === "tooltip") {
    return (
      <div className="relative group">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-surface-elevated border border-border text-[10px] cursor-help">
          🔒
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl border border-border bg-surface-elevated p-3 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
          <p className="text-[11px] font-semibold text-foreground mb-1.5">🔒 Your story is posted anonymously</p>
          <ul className="space-y-1">
            {GUARANTEES.map((g) => (
              <li key={g} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                <span className="shrink-0 text-primary">✓</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="w-full">
        {pill}
        {panel}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {pill}
      {panel}
    </div>
  );
}

// BenchMomentCard — text-only declaration from The Bench.
// No subtext, no buttons (unless explicitly given via actions).
// Dismisses on scroll (1/3 of card scrolled past viewport). Does not auto-dismiss.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface BenchAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
}

export function BenchMomentCard({
  text,
  delayMs = 0,
  actions,
  testId,
}: {
  text: string;
  delayMs?: number;
  actions?: BenchAction[];
  testId?: string;
}) {
  const [visible, setVisible] = useState(delayMs === 0);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Delayed appearance.
  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  // Dismiss on scroll once the card has scrolled mostly out of view.
  useEffect(() => {
    if (!visible || dismissed) return;
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Dismiss when the bottom of the card has scrolled above the top of the viewport.
      if (r.bottom < -8) setDismissed(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visible, dismissed]);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.section
          ref={ref}
          data-testid={testId}
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-border bg-surface-elevated/60 px-6 py-7 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            The Bench
          </p>
          <p className="mt-3 text-lg sm:text-xl font-semibold text-balance leading-snug">
            {text}
          </p>
          {actions && actions.length > 0 && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={
                    a.variant === "ghost"
                      ? "px-5 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
                      : "px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

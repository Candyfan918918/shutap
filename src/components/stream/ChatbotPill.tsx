// ChatbotPill — fixed bottom-center, text only, opens the Bench overlay.
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

export function ChatbotPill() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-1/2 -translate-x-1/2 z-40 px-5 h-11 text-[13px] font-medium"
        style={{
          bottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
          background: "var(--c-text-1, #1a1a1a)",
          color: "var(--c-surface-1, #fff)",
          borderRadius: "var(--r-pill, 9999px)",
          boxShadow: "0 6px 24px -8px rgba(0,0,0,0.4)",
        }}
      >
        Ask The Bench…
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 220 }}
              className="w-full max-w-md rounded-2xl p-4 space-y-3"
              style={{ background: "var(--c-surface-1)", border: "0.5px solid var(--c-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
                The Bench
              </p>
              <p className="text-[13px]" style={{ color: "var(--c-text-1)" }}>
                The bench listens here. Voice replies open next phase.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem("q") as HTMLInputElement | null);
                  const q = (input?.value ?? "").toLowerCase().trim();
                  if (/(hall of fame|leaderboard|\bhof\b|top juror|most dramatic|most controversial)/.test(q)) {
                    const entity = /juror|user|predictor|steelman/.test(q) ? "user" : /story|stories/.test(q) ? "story" : "case";
                    const period = /today|daily/.test(q) ? "daily" : /all.?time/.test(q) ? "all" : /month/.test(q) ? "monthly" : "weekly";
                    let category = "most_dramatic";
                    if (/controversial/.test(q)) category = "most_controversial";
                    else if (/relatable/.test(q)) category = "most_relatable";
                    else if (/predictor/.test(q)) category = "most_accurate_predictor";
                    else if (/juror/.test(q)) category = "top_juror";
                    else if (/shocking/.test(q)) category = "most_shocking";
                    else if (/red.?flag/.test(q)) category = "biggest_red_flag";
                    else if (/green.?flag/.test(q)) category = "biggest_green_flag";
                    window.dispatchEvent(new CustomEvent("open-hof-leaderboard", { detail: { entity, period, category } }));
                    setOpen(false);
                    return;
                  }
                  toast("The bench will respond when chat goes live.");
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  name="q"
                  type="text"
                  placeholder="Ask The Bench…"
                  className="flex-1 px-3 h-10 text-[13px] rounded-full"
                  style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)" }}
                />
                <button
                  type="submit"
                  className="px-4 h-10 text-[12px] font-medium"
                  style={{
                    background: "var(--c-text-1)",
                    color: "var(--c-surface-1)",
                    borderRadius: "var(--r-pill, 9999px)",
                  }}
                >
                  Send
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

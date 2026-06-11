// Green flag celebration — fires once for the author when 90%+ of verdicts
// landed on green_flag. Full-screen, 30 emoji rain (2s), then 3 lines of
// Bench text appear in sequence, then a share CTA fades in.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = { open: boolean; onClose: () => void; onShare?: () => void };

const LINES = [
  "The internet has spoken unanimously.",
  "You were right.",
  "That rarely happens.",
] as const;

export function GreenFlagCelebration({ open, onClose, onShare }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) { setStep(0); return; }
    const timers: number[] = [];
    // emoji rain for 2s, then walk text steps with 1s pauses, then CTA.
    timers.push(window.setTimeout(() => setStep(1), 2000));
    timers.push(window.setTimeout(() => setStep(2), 3000));
    timers.push(window.setTimeout(() => setStep(3), 4000));
    timers.push(window.setTimeout(() => setStep(4), 5000));
    return () => { timers.forEach(window.clearTimeout); };
  }, [open]);

  if (!open) return null;

  const emojis = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 0.6,
  }));

  return (
    <div
      role="dialog"
      aria-label="Green flag celebration"
      className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <AnimatePresence>
        {step < 2 && emojis.map((e) => (
          <motion.span
            key={e.id}
            initial={{ opacity: 0, scale: 0.4, y: 20 }}
            animate={{ opacity: 1, scale: 1.2, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ delay: e.delay, duration: 0.4 }}
            className="absolute text-4xl select-none pointer-events-none"
            style={{ left: `${e.left}%`, top: `${e.top}%` }}
          >
            💚
          </motion.span>
        ))}
      </AnimatePresence>

      <div className="relative z-10 text-center space-y-3 px-6 max-w-md">
        {LINES.map((line, i) => (
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 8 }}
            animate={step > i ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.5 }}
            className="text-foreground text-lg sm:text-xl leading-relaxed"
          >
            {line}
          </motion.p>
        ))}
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={step >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={(ev) => { ev.stopPropagation(); onShare?.(); }}
          className="mt-6 px-5 py-2 rounded-full border border-border bg-card text-foreground text-sm hover:bg-accent transition-colors"
        >
          Make a share card
        </motion.button>
      </div>
    </div>
  );
}

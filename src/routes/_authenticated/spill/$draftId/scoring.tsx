import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { computeChaosScore } from "@/lib/spill.functions";

const LINES = [
  "checking emotional damage…",
  "reviewing suspicious behavior…",
  "measuring mother-in-law intensity…",
  "scanning for receipts…",
  "looking for green flags…",
  "calculating chaos level…",
  "consulting the group chat…",
  "double-checking the plot twists…",
  "searching for signs of true love…",
];

export const Route = createFileRoute("/_authenticated/spill/$draftId/scoring")({
  component: Scoring,
  head: () => ({ meta: [{ title: "Calculating your chaos…" }] }),
});

function Scoring() {
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const compute = useServerFn(computeChaosScore);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const it = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 900);
    let done = false;
    const t = Date.now();
    void (async () => {
      try {
        await compute({ data: { draftId } });
        const wait = Math.max(0, 3200 - (Date.now() - t));
        setTimeout(() => {
          if (done) return;
          done = true;
          navigate({ to: "/spill/$draftId/score", params: { draftId } });
        }, wait);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Scoring failed");
        history.back();
      }
    })();
    return () => {
      clearInterval(it);
      done = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6 overflow-hidden relative">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 -z-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.55_0.22_25 / 0.4), transparent 50%), radial-gradient(circle at 70% 70%, oklch(0.5_0.22_300 / 0.4), transparent 50%)",
        }}
      />
      <div className="relative text-center">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-7xl mb-6"
        >
          🚨
        </motion.div>
        <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Relationship Chaos Score™
        </div>
        <div className="mt-6 h-12 grid place-items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-xl font-semibold"
            >
              {LINES[idx]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-8 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

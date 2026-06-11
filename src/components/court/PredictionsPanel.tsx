// PredictionsPanel — community poll of how a story will end.
// Options come from posts.prediction_options (tagger agent).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  submitPrediction,
  getPredictionSummary,
  getMyPrediction,
  type PredictionSummary,
} from "@/lib/predictions.functions";
import { useGateStore } from "@/stores/gate";
import { supabase } from "@/integrations/supabase/client";

export function PredictionsPanel({ postId }: { postId: string }) {
  const fetchSummary = useServerFn(getPredictionSummary);
  const fetchMine = useServerFn(getMyPrediction);
  const submit = useServerFn(submitPrediction);
  const enqueue = useGateStore((s) => s.enqueue);

  const [summary, setSummary] = useState<PredictionSummary | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let dead = false;
    supabase.auth.getUser().then(({ data }) => !dead && setAuthed(!!data.user));
    fetchSummary({ data: { post_id: postId } }).then((r) => {
      if (!dead) setSummary(r.data);
    });
    return () => {
      dead = true;
    };
  }, [postId, fetchSummary]);

  useEffect(() => {
    if (!authed) return;
    fetchMine({ data: { post_id: postId } }).then((r) => setPick(r.data?.predicted_outcome ?? null));
  }, [authed, postId, fetchMine]);

  if (!summary || summary.options.length === 0) return null;

  async function choose(label: string) {
    if (busy || summary?.locked) return;
    if (!authed) {
      enqueue({ type: "vote", entityId: postId });
      return;
    }
    setBusy(true);
    const prev = pick;
    setPick(label);
    try {
      const r = await submit({
        data: { post_id: postId, predicted_outcome: label, confidence: 3 },
      });
      if (r.error) throw new Error(r.error);
      const fresh = await fetchSummary({ data: { post_id: postId } });
      setSummary(fresh.data);
    } catch (e: any) {
      setPick(prev);
      toast(e?.message ?? "Prediction did not land. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const total = summary.total;
  const locked = summary.locked;

  return (
    <section
      className="rounded-2xl border p-4 sm:p-5 space-y-3"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface)" }}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
            Prediction market
          </div>
          <div className="text-[14px] font-medium" style={{ color: "var(--c-text-1)" }}>
            How does this end?
          </div>
        </div>
        <span className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
          {locked ? "Locked" : `${total.toLocaleString()} in`}
        </span>
      </header>

      <ul className="space-y-1.5">
        {summary.options.map((o) => {
          const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
          const mine = pick === o.label;
          return (
            <li key={o.label}>
              <button
                type="button"
                disabled={busy || locked}
                onClick={() => choose(o.label)}
                className="relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-[13px] transition disabled:cursor-not-allowed"
                style={{
                  borderColor: mine ? "var(--c-amber)" : "var(--c-border)",
                  background: mine ? "#fffaee" : "var(--c-surface-2)",
                  color: "var(--c-text-1)",
                }}
              >
                <motion.span
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-y-0 left-0"
                  style={{ background: mine ? "#fdecc4" : "var(--c-surface-3)" }}
                  aria-hidden
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {mine ? "✓ " : ""}
                    {o.label}
                  </span>
                  <span className="tabular-nums text-[11px]" style={{ color: "var(--c-text-3)" }}>
                    {pct}% · {o.count}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {locked && (
        <p className="text-[11px] italic" style={{ color: "var(--c-text-3)" }}>
          Outcome is in. Predictions sealed.
        </p>
      )}
    </section>
  );
}

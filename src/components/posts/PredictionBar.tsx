// PredictionBar — compact summary shown after verdict locks. Renders top
// predicted outcome from posts.prediction_options + counts via predictions
// table. Hides itself if no predictions exist.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPredictionSummary, type PredictionSummary } from "@/lib/predictions.functions";

interface Props {
  postId: string;
}

export function PredictionBar({ postId }: Props) {
  const fetchSummary = useServerFn(getPredictionSummary);
  const [summary, setSummary] = useState<PredictionSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchSummary({ data: { post_id: postId } });
        if (!cancelled) setSummary(r.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [postId, fetchSummary]);

  if (!summary || summary.total === 0) return null;
  const top = [...summary.options].sort((a, b) => b.count - a.count)[0];
  if (!top) return null;
  const pct = Math.round((top.count / Math.max(summary.total, 1)) * 100);

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px]"
      style={{ background: "var(--c-surface-2, #1a1a1a)", color: "var(--c-text-2)" }}
    >
      <span aria-hidden>🔮</span>
      <span>
        <span className="tabular-nums font-medium" style={{ color: "var(--c-text-1)" }}>{pct}%</span>
        {" predict: "}
        <span className="italic">{top.label}</span>
      </span>
    </div>
  );
}

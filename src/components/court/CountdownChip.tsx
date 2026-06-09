import { useEffect, useState } from "react";

function fmt(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) {
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  }
  const s = Math.floor(ms / 1000);
  return `${s}s`;
}

export function CountdownChip({
  to,
  prefix = "Judgment in",
  closedLabel = "Judgment landed",
  className = "",
}: {
  to: string | null;
  prefix?: string;
  closedLabel?: string;
  className?: string;
}) {
  const target = to ? new Date(to).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!target) return null;
  const remaining = target - now;
  const closed = remaining <= 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
        closed
          ? "bg-surface-elevated border-border text-muted-foreground"
          : "bg-primary/15 border-primary/40 text-primary"
      } ${className}`}
    >
      <span aria-hidden>{closed ? "👑" : "⏳"}</span>
      <span>
        {closed ? closedLabel : `${prefix} ${fmt(remaining)}`}
      </span>
    </span>
  );
}

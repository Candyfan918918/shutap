// Dense metric tile. No animations; skeleton variant for loading.
export function MetricCard({
  label,
  value,
  deltaPct,
}: {
  label: string;
  value: number;
  deltaPct: number | null;
}) {
  const deltaColor =
    deltaPct == null
      ? "text-zinc-500"
      : deltaPct > 0
        ? "text-emerald-400"
        : deltaPct < 0
          ? "text-rose-400"
          : "text-zinc-500";
  const deltaLabel =
    deltaPct == null ? "no baseline" : `${deltaPct > 0 ? "+" : ""}${deltaPct}% vs prior`;
  return (
    <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-medium text-zinc-100 tabular-nums">{value.toLocaleString()}</div>
      <div className={`mt-0.5 text-xs ${deltaColor}`}>{deltaLabel}</div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-3">
      <div className="h-3 w-24 bg-zinc-800 rounded" />
      <div className="mt-2 h-7 w-16 bg-zinc-800 rounded" />
      <div className="mt-2 h-3 w-20 bg-zinc-800 rounded" />
    </div>
  );
}

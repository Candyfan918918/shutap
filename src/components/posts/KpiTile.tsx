// Single KPI tile for the analytics page.
import type { ReactNode } from "react";

export function KpiTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-elevated border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="text-base">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

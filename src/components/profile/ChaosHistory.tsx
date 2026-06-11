// Timeline of chaos scores.
import { Link } from "@tanstack/react-router";
import type { ChaosHistoryRow } from "@/lib/posts/public.functions";

function band(score: number): { color: string; label: string } {
  if (score >= 800) return { color: "from-red-500 to-orange-500", label: "🌋 legendary" };
  if (score >= 600) return { color: "from-orange-500 to-amber-500", label: "🔥 turbulent" };
  if (score >= 400) return { color: "from-amber-500 to-yellow-500", label: "🤔 chaotic" };
  if (score >= 200) return { color: "from-violet-500 to-fuchsia-500", label: "💜 spicy" };
  return { color: "from-emerald-500 to-teal-500", label: "💚 peaceful" };
}

export function ChaosHistory({ rows }: { rows: ChaosHistoryRow[] }) {
  if (!rows.length) {
    return (
      <div className="px-8 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-3">📊</div>
        <div>No scans on the record yet.</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3">
      <div className="text-xs text-muted-foreground italic">character development.</div>
      {rows.map((r, i) => {
        const b = band(r.score);
        const prev = rows[i + 1];
        const delta = prev ? r.score - prev.score : 0;
        return (
          <Link
            key={r.scanId}
            to="/scan/result/$scanId"
            params={{ scanId: r.scanId }}
            className="block rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-medium tabular-nums">
                  {r.score}
                  <span className="text-sm font-normal text-muted-foreground"> / 1000</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{r.category ?? b.label}</div>
              </div>
              <div className="text-right">
                {prev && (
                  <div className={`text-sm font-medium ${delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : ""}
                </div>
              </div>
            </div>
            <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${b.color}`} style={{ width: `${Math.min(100, r.score / 10)}%` }} />
          </Link>
        );
      })}
    </div>
  );
}

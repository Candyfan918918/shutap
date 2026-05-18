// User's scan history.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyScans } from "@/lib/scan.functions";
import { bandForScore } from "@/lib/scan/types";

export const Route = createFileRoute("/_authenticated/profile/scans")({
  component: ScansHistoryPage,
  head: () => ({ meta: [{ title: "Your Drama Scans — Marriage Drama" }] }),
});

function ScansHistoryPage() {
  const fetchScans = useServerFn(listMyScans);
  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans", "mine"],
    queryFn: () => fetchScans(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <span className="font-semibold">Your scans</span>
          <Link to="/scan" className="text-sm text-primary">+ New</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : !scans || scans.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎬</div>
            <p className="text-muted-foreground mb-6">
              No scans yet. Your drama story starts now.
            </p>
            <Link
              to="/scan"
              className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
            >
              Start your first scan →
            </Link>
          </div>
        ) : (
          scans.map((s) => {
            const band = s.score !== null ? bandForScore(s.score) : null;
            const body = (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                  <div className="font-bold mt-0.5">
                    {s.status === "completed"
                      ? `${band?.emoji ?? ""} ${s.category ?? "—"}`
                      : "⏳ In progress"}
                  </div>
                </div>
                <div className="text-3xl font-black tabular-nums">
                  {s.score ?? "—"}
                </div>
              </div>
            );
            const cls =
              "block rounded-2xl border border-border bg-surface-elevated p-4 hover:border-primary/40 transition";
            return s.status === "completed" ? (
              <Link
                key={s.id}
                to="/scan/result/$scanId"
                params={{ scanId: s.id }}
                className={cls}
              >
                {body}
              </Link>
            ) : (
              <Link
                key={s.id}
                to="/scan/question/$step"
                params={{ step: String(s.current_step) }}
                search={{ scanId: s.id }}
                className={cls}
              >
                {body}
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}

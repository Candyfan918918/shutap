// Result reveal screen. Public-readable for completed scans (share links).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ScoreReveal } from "@/components/drama/ScoreReveal";
import { getScan } from "@/lib/scan.functions";
import { bandForScore, type ScoreResult, type Subscores } from "@/lib/scan/types";

export const Route = createFileRoute("/_authenticated/scan/result/$scanId")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Your Shutap Chaos Score™" },
      {
        name: "description",
        content: "Cinematic reveal: total score, subscores, badges, and what it means.",
      },
    ],
  }),
});

function ResultPage() {
  const { scanId } = Route.useParams();
  const navigate = useNavigate();
  const fetchScan = useServerFn(getScan);
  const { data: scan, isLoading, error } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => fetchScan({ data: { scanId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Calculating your drama score…
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-muted-foreground mb-4">This scan vanished into the void.</p>
          <Link to="/scan" className="text-primary underline">Take a new one →</Link>
        </div>
      </div>
    );
  }

  if (scan.status !== "completed" || scan.score === null) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-muted-foreground mb-4">This scan isn't finished yet.</p>
          <button
            onClick={() =>
              navigate({
                to: "/scan/question/$step",
                params: { step: String(scan.current_step) },
                search: { scanId },
              })
            }
            className="text-primary underline"
          >
            Continue scanning →
          </button>
        </div>
      </div>
    );
  }

  const result: ScoreResult = {
    totalScore: scan.score,
    subscores: (scan.subscores ?? {
      plot_twists: 0,
      emotional: 0,
      financial: 0,
      family: 0,
      communication: 0,
      love_bonus: 0,
      foundation: 0,
    }) as Subscores,
    category: scan.category ?? bandForScore(scan.score).label,
    categoryKey: bandForScore(scan.score).key,
    percentile: scan.percentile ?? 50,
    tags: scan.tags ?? [],
    badges: scan.badges ?? [],
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/85 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/scan" className="text-sm text-muted-foreground">
            ← New scan
          </Link>
          <span className="font-semibold">Chaos Score™</span>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <ScoreReveal result={result} locale={scan.locale} />
        </motion.div>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex gap-2">
          <Link
            to="/profile/scans"
            className="px-4 py-3 rounded-full bg-surface-elevated border border-border text-sm font-medium grid place-items-center"
          >
            History
          </Link>
          {scan.post_id ? (
            <Link
              to="/post/$postId"
              params={{ postId: scan.post_id }}
              search={{ shared: 0 }}
              className="flex-[2] px-4 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm grid place-items-center"
            >
              ✨ View your post
            </Link>
          ) : (
            <Link
              to="/compose"
              search={{ score: scan.score, scanId: scan.id }}
              className="flex-[2] px-4 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm grid place-items-center"
            >
              ✨ Turn into a post
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

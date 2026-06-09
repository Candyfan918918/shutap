// Scan splash + start CTA. Detects an in-progress scan and offers resume.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getActiveScan } from "@/lib/scan.functions";

export const Route = createFileRoute("/_authenticated/scan/")({
  component: ScanIntro,
  head: () => ({
    meta: [
      { title: "Shutap Relationship Scan — How dramatic is your marriage?" },
      {
        name: "description",
        content:
          "Take the 3-minute Shutap Relationship Scan. Anonymous, surprisingly accurate, slightly chaotic.",
      },
    ],
  }),
});

function ScanIntro() {
  const navigate = useNavigate();
  const fetchActive = useServerFn(getActiveScan);
  const { data: active, isLoading } = useQuery({
    queryKey: ["scan", "active"],
    queryFn: () => fetchActive(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-4 pt-4">
        <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-7xl mb-6"
        >
          👀
        </motion.div>
        <div className="text-xs font-medium tracking-wider text-accent uppercase mb-3">
          Judge My Relationship™
        </div>
        <h1 className="text-4xl sm:text-5xl font-medium leading-tight text-balance">
          90 seconds. mostly tapping.
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-md text-balance">
          Like your funniest smartest friend asking questions over wine.
          We score the chaos at the end.
        </p>

        <div className="mt-10 w-full space-y-3">
          {active && !isLoading ? (
            <>
              <Link
                to="/scan/result/$scanId"
                params={{ scanId: active.id }}
                className="block w-full px-6 py-4 rounded-full bg-surface-elevated border border-border font-medium text-base"
              >
                see your last score →
              </Link>
              <Link
                to="/scan/start"
                className="block w-full px-6 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg "
              >
                start a new one →
              </Link>
            </>
          ) : (
            <Link
              to="/scan/start"
              className="block w-full px-6 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg "
            >
              👀 okay let's go →
            </Link>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Anonymous. We hide names. Your secrets are safe.
        </p>
      </main>
    </div>
  );
}

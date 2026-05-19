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
      { title: "Marriage Drama Scan™ — How dramatic is your marriage?" },
      {
        name: "description",
        content:
          "Take the 3-minute Marriage Drama Scan™. Anonymous, surprisingly accurate, slightly chaotic.",
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
        <div className="text-xs font-bold tracking-wider text-accent uppercase mb-3">
          Judge My Relationship™
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight text-balance">
          Okay… let me ask you a few things.
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-md text-balance">
          Like a nosy best friend, not a therapist. ~26 questions. About 3 minutes.
          We'll score the chaos at the end.
        </p>

        <div className="mt-10 w-full space-y-3">
          {active && !isLoading ? (
            <>
              <button
                onClick={() =>
                  navigate({
                    to: "/scan/question/$step",
                    params: { step: String(active.current_step) },
                    search: { scanId: active.id },
                  })
                }
                className="w-full px-6 py-4 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-lg shadow-lg"
              >
                Pick up where we left off →
              </button>
              <Link
                to="/scan/start"
                className="block text-sm text-muted-foreground underline"
              >
                Nope, start fresh
              </Link>
            </>
          ) : (
            <Link
              to="/scan/start"
              className="block w-full px-6 py-4 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-lg shadow-lg"
            >
              Fine, ask me. →
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

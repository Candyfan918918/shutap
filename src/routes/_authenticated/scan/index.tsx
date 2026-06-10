// Scan splash — dramatic Bench opening. Visual reference: shutap_scan_dramatic.html
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getActiveScan } from "@/lib/scan.functions";

export const Route = createFileRoute("/_authenticated/scan/")({
  component: ScanIntro,
  head: () => ({
    meta: [
      { title: "Assess my situation — Shutap" },
      { name: "description", content: "The Bench is listening. Your story. No names. The court will decide." },
    ],
  }),
});

function ScanIntro() {
  const fetchActive = useServerFn(getActiveScan);
  const { data: active, isLoading } = useQuery({
    queryKey: ["scan", "active"],
    queryFn: () => fetchActive(),
  });

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">←</Link>
          <div className="flex-1 text-center text-sm font-medium">Assess my situation</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-xl">
        <section className="hero-dark">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hero-dark__tag">The Bench is listening</div>
          <h1 className="hero-dark__q">
            What happened?
            <br />Don't soften it.
          </h1>
          <p className="hero-dark__sub">Your story. No names needed. The court will decide.</p>
          <div className="inline-flex items-center gap-1.5 mt-2 text-[10px] text-c-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-c-teal animate-pulse" />
            The Bench takes one case at a time
          </div>
        </section>

        <div className="px-3 py-4 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="brow-av">⚖️</div>
            <div className="brow-bubble max-w-[260px]">
              Give it to me straight. <b className="text-c-ink font-medium">What did they do?</b>
            </div>
          </div>
          <p className="bench-line !my-0 mx-0 text-[11px]">
            No names. No identifying details. You review and approve before anything posts.
          </p>
        </div>

        <div className="px-3 pt-3 space-y-2.5">
          {active && !isLoading ? (
            <>
              <Link
                to="/scan/result/$scanId"
                params={{ scanId: active.id }}
                className="block w-full py-3.5 text-center rounded-2xl bg-c-surface-2 border border-c-surface-3 text-sm font-medium"
              >
                See your last score →
              </Link>
              <Link
                to="/scan/start"
                className="block w-full py-3.5 text-center rounded-2xl bg-c-pink text-white text-[15px] font-medium"
              >
                Open a new case →
              </Link>
            </>
          ) : (
            <Link
              to="/scan/start"
              className="block w-full py-3.5 text-center rounded-2xl bg-c-pink text-white text-[15px] font-medium"
            >
              Tell the Bench →
            </Link>
          )}
          <p className="text-center text-[11px] text-c-text-3 pt-2">
            Anonymous by default. The court doesn't need your name to see what happened.
          </p>
        </div>
      </main>
    </div>
  );
}

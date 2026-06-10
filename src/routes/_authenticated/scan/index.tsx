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
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">←</Link>
          <div className="flex-1 text-center text-sm font-medium">Assess my situation</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-surface-3 bg-c-surface">
        {/* DRAMATIC HERO */}
        <section className="hero-dark scan-hero">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hero-dark__tag">The Bench is listening</div>
          <h1 className="scan-hero__q">
            What happened?
            <br />Don't soften it.
          </h1>
          <p className="hero-dark__sub">Your story. No names needed. The court will decide.</p>
          <div className="inline-flex items-center gap-1.5 mt-2.5 text-[10px] text-c-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-c-teal animate-pulse" />
            4,821 cases assessed today
          </div>
        </section>

        {/* CHAT PREVIEW */}
        <div className="scan-chat">
          <BenchBubble>
            Give it to me straight. <b className="text-c-ink font-medium">What did they do?</b>
          </BenchBubble>

          <UserBubble>
            My boyfriend deleted every message thread right before handing me his phone. Took him 5 whole minutes.
          </UserBubble>

          <ReactBubble>
            <strong className="text-c-ink font-medium">Five minutes.</strong> That's not cleaning up. That's deciding what to hide.
          </ReactBubble>

          <BenchBubble>
            Ready to give the Bench your version? <em className="not-italic text-c-pink-ink">No names. No identifying details.</em> You review everything before it posts.
          </BenchBubble>
        </div>

        {/* CTA */}
        <div className="px-3 pt-4 pb-6 space-y-2.5">
          {active && !isLoading ? (
            <>
              <Link
                to="/scan/result/$scanId"
                params={{ scanId: active.id }}
                className="block w-full py-3.5 text-center rounded-2xl bg-c-surface-2 border border-c-surface-3 text-sm font-medium text-c-text-2"
              >
                See your last score →
              </Link>
              <Link
                to="/scan/start"
                className="block w-full py-4 text-center rounded-2xl bg-c-pink text-white text-[15px] font-medium"
              >
                Open a new case →
              </Link>
            </>
          ) : (
            <Link
              to="/scan/start"
              className="block w-full py-4 text-center rounded-2xl bg-c-pink text-white text-[15px] font-medium"
            >
              Tell the Bench →
            </Link>
          )}
          <p className="text-center text-[11px] text-c-text-3 pt-1.5">
            Anonymous by default. The court doesn't need your name to see what happened.
          </p>
        </div>

        {/* TRUST STRIP */}
        <div className="mx-3 mb-6 rounded-xl bg-c-teal-soft border border-c-teal-border px-3 py-2.5 text-[11px] text-c-teal-deep flex items-start gap-2">
          <span>🛡</span>
          <span>Privacy Shield scrubs identifying details before anything goes public. You approve every word.</span>
        </div>
      </main>
    </div>
  );
}

function BenchBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-end">
      <div className="brow-av">⚖️</div>
      <div className="brow-bubble max-w-[80%]">{children}</div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="user-bubble max-w-[80%]">{children}</div>
    </div>
  );
}

function ReactBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="brow-av">⚖️</div>
      <div className="react-bubble flex-1">{children}</div>
    </div>
  );
}

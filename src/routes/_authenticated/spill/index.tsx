// Spill landing — co-pilot opens the case. Visual reference: shutap_spill_flow.html
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/spill/")({
  component: SpillLanding,
  head: () => ({
    meta: [
      { title: "Spill — Shutap" },
      { name: "description", content: "Tell the court what happened. One question at a time. Your words, your story." },
    ],
  }),
});

function SpillLanding() {
  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">✕</Link>
          <div className="flex-1 text-center text-sm font-medium">Spill</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl">
        <section className="hero-dark">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hero-dark__tag">The co-pilot is listening</div>
          <h1 className="hero-dark__q">
            Tell the court<br />what happened.
          </h1>
          <p className="hero-dark__sub">
            One question at a time. Your words, your story — The Bench just draws it out.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {[
              "No names. No identifying details.",
              "The more you give, the sharper the verdict.",
              "You review and approve before anything posts.",
            ].map((r) => (
              <div key={r} className="flex items-center gap-2 text-[11px] text-c-ink-3">
                <span className="w-1.5 h-1.5 rounded-full bg-c-pink flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </section>

        <div className="px-3.5 pt-4 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="brow-av">⚖️</div>
            <div className="brow-bubble max-w-[260px]">
              What happened? Start wherever feels right — <b className="text-c-ink font-medium">don't edit yourself.</b>
            </div>
          </div>
        </div>

        <div className="px-3.5 pt-5 space-y-2.5">
          <Link
            to="/spill/start"
            search={{ voice: 0 }}
            className="block w-full py-3.5 text-center rounded-2xl bg-c-pink-soft text-c-pink-ink border border-c-pink-border text-[15px] font-medium"
          >
            Start talking →
          </Link>
          <Link
            to="/spill/start"
            search={{ voice: 1 }}
            className="block w-full py-3 text-center rounded-2xl bg-c-surface-2 border border-c-surface-3 text-sm font-medium"
          >
            🎙 Tell it out loud
          </Link>
          <p className="text-center text-[11px] text-c-text-3 pt-2">
            🔒 Anonymous. The court doesn't need your name.
          </p>
        </div>
      </main>
    </div>
  );
}

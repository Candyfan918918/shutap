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

const RULES = [
  "No names. No identifying details.",
  "The more you give, the sharper the verdict.",
  "You review and approve before anything posts.",
];

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

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-surface-3 bg-c-surface">
        {/* HERO */}
        <section className="hero-dark spill-hero">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hero-dark__tag">The co-pilot is listening</div>
          <h1 className="spill-hero__q">
            Tell the court<br />what happened.
          </h1>
          <p className="hero-dark__sub">
            One question at a time. Your words, your story — The Bench just draws it out.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {RULES.map((r) => (
              <div key={r} className="flex items-center gap-2 text-[11px] text-c-ink-3">
                <span className="w-[5px] h-[5px] rounded-full bg-c-pink flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </section>

        {/* PROGRESS RAIL */}
        <div className="px-3.5 pt-3 pb-2.5 bg-c-surface">
          <div className="h-1 rounded-full bg-c-surface-3 overflow-hidden">
            <div className="h-full bg-c-pink rounded-full" style={{ width: "12%" }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-c-text-3">
            <span className="text-c-pink font-medium">Opening</span>
            <span>Context</span>
            <span>The incident</span>
            <span>After</span>
            <span>Ready</span>
          </div>
        </div>

        {/* CHAT OPENER */}
        <div className="spill-chat">
          <div className="flex gap-2 items-end">
            <div className="brow-av">⚖️</div>
            <div className="brow-bubble max-w-[80%]">
              What happened? Start wherever feels right — <b className="text-c-ink font-medium">don't edit yourself.</b>
            </div>
          </div>
        </div>

        {/* COMPOSER PREVIEW */}
        <div className="mt-4 border-t border-c-surface-3 bg-c-surface px-3.5 pt-3 pb-4">
          <div className="bg-white border border-c-surface-3 rounded-2xl px-3.5 py-3">
            <div className="text-[13px] text-c-text-3 italic min-h-[52px]">
              Start talking. The Bench is listening…
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-[11px] text-c-text-3">0 words</div>
              <Link
                to="/spill/start"
                search={{ voice: 0 }}
                className="w-9 h-9 rounded-full bg-c-pink text-white grid place-items-center"
                aria-label="Start talking"
              >
                ↑
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Link
              to="/spill/start"
              search={{ voice: 0 }}
              className="py-3 text-center rounded-2xl bg-c-pink text-white text-sm font-medium"
            >
              Start typing →
            </Link>
            <Link
              to="/spill/start"
              search={{ voice: 1 }}
              className="py-3 text-center rounded-2xl bg-c-surface-2 border border-c-surface-3 text-sm font-medium text-c-text-2"
            >
              🎙 Tell it out loud
            </Link>
          </div>
          <p className="text-center text-[11px] text-c-text-3 pt-2.5">
            🔒 Anonymous. The court doesn't need your name.
          </p>
        </div>
      </main>
    </div>
  );
}

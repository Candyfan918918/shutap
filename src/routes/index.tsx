// Shutap marketing homepage. SSR via loader → server fn.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  getHomepageData,
  type LiveCase,
  type ResolvedCase,
  type HofEntry,
  type HofStats,
  type StreamStory,
} from "@/lib/marketing/homepage.functions";
import { headHome } from "@/lib/seo/meta";

const BENCH_LINES = [
  "The court does not adjourn.",
  "Someone is being judged as you read this.",
  "Justice is crowdsourced here.",
];

function dailyBenchLine(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return BENCH_LINES[day % BENCH_LINES.length];
}

function formatVerdictKind(k: string | null): string {
  if (!k) return "no verdict yet";
  return k.replace(/_/g, " ");
}

function timeUntil(iso: string | null): string {
  if (!iso) return "open";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "locking now";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)}d to verdict`;
  if (h >= 1) return `${h}h to verdict`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m to verdict`;
}

export const Route = createFileRoute("/")({
  loader: () => getHomepageData(),
  component: HomePage,
  head: ({ loaderData }) => headHome(loaderData?.totalVerdicts),
  errorComponent: ({ error }) => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2 max-w-md text-center">The bench is unavailable. {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2">This case doesn't exist.</p>
    </main>
  ),
});

const APP = "https://app.shutap.com";

// ────────────────────────────────────────────────────────────────────────
// Motion hooks (no external libs, single-fire IO + rAF count-up)
// ────────────────────────────────────────────────────────────────────────

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      options,
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView] as const;
}

function useCountUp(target: number, duration = 1800, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

function HomePage() {
  const { totalVerdicts, liveCases, resolvedCase, hofStats, hofEntries, streamStories } =
    Route.useLoaderData() as import("@/lib/marketing/homepage.functions").HomepageData;
  const benchLine = dailyBenchLine();

  const animatedVerdicts = useCountUp(totalVerdicts, 1800, true);

  // Section refs for fade-in reveals
  const [docketRef, docketIn] = useInView<HTMLElement>({ threshold: 0.1 });
  const [howRef, howIn] = useInView<HTMLElement>({ threshold: 0.1 });
  const [proofRef, proofIn] = useInView<HTMLElement>({ threshold: 0.1 });
  const [hofRef, hofIn] = useInView<HTMLElement>({ threshold: 0.2 });
  const [streamRef, streamIn] = useInView<HTMLElement>({ threshold: 0.05 });
  const [whyRef, whyIn] = useInView<HTMLElement>({ threshold: 0.1 });

  // Docket cards trigger (slightly tighter threshold for the cards themselves)
  const [docketListRef, docketListIn] = useInView<HTMLUListElement>({ threshold: 0.15 });

  // HOF count-ups gated on band in-view
  const verdictsWeek = useCountUp(hofStats.verdictsThisWeek, 1400, hofIn);
  const casesDecided = useCountUp(hofStats.casesDecided, 1400, hofIn);
  const unanimousPct = useCountUp(hofStats.unanimousPct, 1400, hofIn);

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ghostDrift {
          0%   { transform: translate(-50%,-50%) scale(1)   rotate(0deg); }
          33%  { transform: translate(-51%,-49%) scale(1.02) rotate(0.4deg); }
          66%  { transform: translate(-49%,-51%) scale(0.98) rotate(-0.3deg); }
          100% { transform: translate(-50%,-50%) scale(1)   rotate(0deg); }
        }
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,80,64,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(212,80,64,0); }
        }

        .hero-ghost {
          position: absolute;
          top: 50%; left: 50%;
          font-family: serif;
          font-size: clamp(180px, 30vw, 360px);
          line-height: 1;
          font-weight: 700;
          color: var(--c-text-1);
          opacity: 0.035;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          animation: ghostDrift 14s ease-in-out infinite;
        }

        .anim-fadeup     { opacity: 0; animation: fadeUp 0.6s ease forwards; }
        .anim-fadeup-1   { opacity: 0; animation: fadeUp 0.6s ease forwards; animation-delay: 0.15s; }
        .anim-fadeup-2   { opacity: 0; animation: fadeUp 0.6s ease forwards; animation-delay: 0.3s; }

        .live-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 9999px;
          background: rgb(212,80,64);
          margin-right: 8px;
          vertical-align: middle;
          animation: livePulse 1.8s ease-in-out infinite;
        }

        .section-reveal { opacity: 0; transition: opacity 0.5s ease; }
        .section-reveal.in-view { opacity: 1; }

        .docket-card {
          opacity: 0;
          transform: translateY(22px);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .docket-list.in-view .docket-card {
          animation: cardIn 0.45s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .docket-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .docket-card .verdict-bar {
          width: 0%;
          transition: width 0.8s cubic-bezier(0.22,1,0.36,1);
        }
        .docket-list.in-view .docket-card .verdict-bar {
          width: var(--bar-width);
        }

        .cta-primary { transition: transform 0.18s ease; }
        .cta-primary:hover { transform: scale(1.03); }
        .cta-ghost { transition: background-color 0.18s ease; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <SiteHeader />

      {/* HERO */}
      <section className="border-b border-c-border relative overflow-hidden">
        <span aria-hidden className="hero-ghost">§</span>
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28 relative">
          <h1 className="anim-fadeup text-balance font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight text-c-text-1">
            Spill it. The court decides.
          </h1>
          <p className="anim-fadeup-1 mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-c-text-2">
            Shutap is the anonymous court of public opinion. Share what happened, get a verdict from
            thousands of real people — then come back and tell the world how it actually ended.
          </p>
          <div className="anim-fadeup-2 mt-10 flex flex-wrap gap-3">
            <a
              href={`${APP}/spill`}
              className="cta-primary inline-flex items-center justify-center rounded-md bg-c-text-1 px-5 py-3 text-sm font-medium text-c-surface hover:opacity-90"
            >
              Open a Case
            </a>
            <a
              href={`${APP}/court`}
              className="cta-ghost inline-flex items-center justify-center rounded-md border border-c-border px-5 py-3 text-sm font-medium text-c-text-1 hover:bg-c-surface-2"
            >
              Enter the Court
            </a>
          </div>
          <p className="mt-8 text-xs text-c-text-3 tabular-nums">
            <span className="text-c-text-2 font-medium">{animatedVerdicts.toLocaleString()}</span>{" "}
            verdicts cast. Zero real names. Ever.
          </p>
        </div>
      </section>

      {/* SECTION 1 — THE DOCKET */}
      <section
        ref={docketRef}
        className={`section-reveal border-b border-c-border ${docketIn ? "in-view" : ""}`}
      >
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">
            <span className="live-dot" aria-hidden />
            In Session Right Now
          </h2>
          <p className="mt-2 text-sm italic text-c-text-3">{benchLine}</p>
          <ul
            ref={docketListRef}
            className={`docket-list mt-8 grid gap-4 sm:grid-cols-3 ${docketListIn ? "in-view" : ""}`}
          >
            {liveCases.length === 0 ? (
              <li className="text-sm text-c-text-3 sm:col-span-3">The docket is quiet. Come back in an hour.</li>
            ) : (
              liveCases.map((c, i) => <DocketCard key={c.caseId} c={c} index={i} />)
            )}
          </ul>
        </div>
      </section>

      {/* SECTION 2 — HOW IT WORKS */}
      <section
        ref={howRef}
        className={`section-reveal border-b border-c-border ${howIn ? "in-view" : ""}`}
      >
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">Every Story Gets a Verdict</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {([
              ["Spill.", "Tell it your way. An interviewer draws the story out of you — it never writes a word for you."],
              ["Judgment.", "Thousands of strangers vote: guilty, not guilty, red flag, run. The verdict locks on a deadline."],
              ["The Outcome.", "Months later, you come back and tell the court what actually happened. That part matters most."],
            ] as const).map(([head, body], i) => (
              <li key={head}>
                <div className="text-xs uppercase tracking-wider text-c-text-3 tabular-nums">{i + 1}</div>
                <div className="mt-2 font-serif text-xl text-c-text-1">{head}</div>
                <p className="mt-2 text-sm leading-relaxed text-c-text-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SECTION 3 — PROOF */}
      <section
        ref={proofRef}
        className={`section-reveal border-b border-c-border ${proofIn ? "in-view" : ""}`}
      >
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">What Happened Next</h2>
          {resolvedCase ? <OutcomeBlock c={resolvedCase} /> : (
            <p className="mt-6 text-sm text-c-text-3">No resolved cases to show yet.</p>
          )}
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-c-text-2">
            Most platforms stop at opinions. Shutap follows the story until it ends.
          </p>
        </div>
      </section>

      {/* SECTION 4 — WHY IT EXISTS */}
      <section
        ref={whyRef}
        className={`section-reveal border-b border-c-border ${whyIn ? "in-view" : ""}`}
      >
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">In an AI World, Stay Human</h2>
          <div className="mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-c-text-2">
            <p>Artificial intelligence can generate answers.</p>
            <p>Only humans can generate experience.</p>
            <p>Every case here was lived by someone.</p>
            <p>Every verdict was cast by a person.</p>
            <p>Every outcome really happened.</p>
            <p className="pt-2 text-c-text-1">Shutap preserves what makes us human:</p>
            <p className="font-serif text-lg text-c-text-1">
              mistakes · growth · forgiveness · courage · resilience
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function DocketCard({ c, index }: { c: LiveCase; index: number }) {
  const pct = Math.max(4, c.topVerdictPct);
  return (
    <li
      className="docket-card rounded-md border border-c-border bg-c-surface-2 p-4"
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <Link to="/case/$caseSlug" params={{ caseSlug: c.postId }} className="block group">
        <div className="text-[10px] uppercase tracking-wider text-c-text-3">{c.courtBadge}</div>
        <div className="mt-2 font-serif text-base leading-snug text-c-text-1 group-hover:underline underline-offset-4">
          {c.title}
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-c-surface-3">
          <div
            className="verdict-bar h-full bg-c-text-1"
            style={{
              ["--bar-width" as any]: `${pct}%`,
              transitionDelay: `${index * 0.1 + 0.2}s`,
            }}
            aria-label={`${c.topVerdictPct}% ${formatVerdictKind(c.topVerdictKind)}`}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-c-text-3 tabular-nums">
          <span>{c.topVerdictPct}% {formatVerdictKind(c.topVerdictKind)}</span>
          <span>{timeUntil(c.closesAt)}</span>
        </div>
      </Link>
    </li>
  );
}

function OutcomeBlock({ c }: { c: ResolvedCase }) {
  return (
    <article className="mt-6 rounded-md border border-c-border bg-c-surface-2 p-6 sm:p-8">
      <Link to="/case/$caseSlug" params={{ caseSlug: c.postId }} className="block group">
        <div className="text-[10px] uppercase tracking-wider text-c-text-3">Resolved · {c.daysToOutcome} days to outcome</div>
        <h3 className="mt-2 font-serif text-xl sm:text-2xl leading-tight text-c-text-1 group-hover:underline underline-offset-4">
          {c.title}
        </h3>
        <div className="mt-4 text-xs text-c-text-3 tabular-nums">
          Community verdict:{" "}
          <span className="text-c-text-1 font-medium">{c.verdictPct}% {formatVerdictKind(c.verdictKind)}</span>
        </div>
        {c.outcomeSnippet ? (
          <p className="mt-4 text-sm leading-relaxed text-c-text-2">{c.outcomeSnippet}</p>
        ) : null}
      </Link>
    </article>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-c-border">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-serif text-base tracking-tight text-c-text-1">Shutap</a>
        <nav className="flex items-center gap-5 text-xs text-c-text-2">
          <a href={`${APP}/court`} className="hover:text-c-text-1">Enter the Court</a>
          <a href={`${APP}/spill`} className="hover:text-c-text-1">Open a Case</a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-c-surface">
      <div className="mx-auto max-w-4xl px-6 py-12 grid gap-8 sm:grid-cols-3 text-xs text-c-text-2">
        <div>Shutap — The world's memory of human experience.</div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-center">
          <a href={`${APP}/court`} className="hover:text-c-text-1">Enter the Court</a>
          <a href={`${APP}/spill`} className="hover:text-c-text-1">Open a Case</a>
          <a href="/#docket" className="hover:text-c-text-1">The Docket</a>
          <a href="/data" className="hover:text-c-text-1">Data</a>
          <a href="/about" className="hover:text-c-text-1">About</a>
          <a href="/privacy" className="hover:text-c-text-1">Privacy</a>
          <a href="/community-standards" className="hover:text-c-text-1">Community Standards</a>
          <a href="/transparency" className="hover:text-c-text-1">Transparency Report</a>
        </nav>
        <div className="sm:text-right">18+ · Anonymous · Real verdicts · Real outcomes</div>
      </div>
      <div className="border-t border-c-border">
        <div className="mx-auto max-w-4xl px-6 py-4 text-xs italic text-c-text-3">
          In an AI world, stay human.
        </div>
      </div>
    </footer>
  );
}

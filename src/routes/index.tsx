// Shutap marketing homepage. SSR via loader → server fn. Typography only, no
// above-the-fold animation. All content rules below are exact per spec.
import { createFileRoute, Link } from "@tanstack/react-router";
import { getHomepageData, type LiveCase, type ResolvedCase } from "@/lib/marketing/homepage.functions";

const CANONICAL = "https://shutap.com/";
const BENCH_LINES = [
  "The court does not adjourn.",
  "Someone is being judged as you read this.",
  "Justice is crowdsourced here.",
];

function dailyBenchLine(): string {
  // Deterministic rotation by UTC day so SSR + CSR match.
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
  head: ({ loaderData }) => {
    const total = loaderData?.totalVerdicts ?? 0;
    const desc =
      "Shutap is the anonymous court of public opinion. Share what happened, get a verdict from thousands of real people — then come back and tell the world how it actually ended.";
    return {
      meta: [
        { title: "Shutap — Spill it. The court decides." },
        { name: "description", content: desc },
        { property: "og:title", content: "Shutap — Spill it. The court decides." },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: CANONICAL },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Shutap — Spill it. The court decides." },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: CANONICAL }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Shutap",
            url: "https://shutap.com",
            description:
              "The anonymous court of public opinion. Real cases, real verdicts, real outcomes.",
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Shutap",
            url: "https://shutap.com",
            inLanguage: "en",
            description: `${total.toLocaleString()} verdicts cast. Zero real names. Ever.`,
          }),
        },
      ],
    };
  },
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

function HomePage() {
  const { totalVerdicts, liveCases, resolvedCase } = Route.useLoaderData();
  const benchLine = dailyBenchLine();

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <SiteHeader />

      {/* HERO */}
      <section className="border-b border-c-border">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
          <h1 className="text-balance font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight text-c-text-1">
            Spill it. The court decides.
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-c-text-2">
            Shutap is the anonymous court of public opinion. Share what happened, get a verdict from
            thousands of real people — then come back and tell the world how it actually ended.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={`${APP}/spill`}
              className="inline-flex items-center justify-center rounded-md bg-c-text-1 px-5 py-3 text-sm font-medium text-c-surface hover:opacity-90 transition"
            >
              Open a Case
            </a>
            <a
              href={`${APP}/court`}
              className="inline-flex items-center justify-center rounded-md border border-c-border px-5 py-3 text-sm font-medium text-c-text-1 hover:bg-c-surface-2 transition"
            >
              Enter the Court
            </a>
          </div>
          <p className="mt-8 text-xs text-c-text-3 tabular-nums">
            <span className="text-c-text-2 font-medium">{totalVerdicts.toLocaleString()}</span>{" "}
            verdicts cast. Zero real names. Ever.
          </p>
        </div>
      </section>

      {/* SECTION 1 — THE DOCKET */}
      <section className="border-b border-c-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">In Session Right Now</h2>
          <p className="mt-2 text-sm italic text-c-text-3">{benchLine}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {liveCases.length === 0 ? (
              <li className="text-sm text-c-text-3 sm:col-span-3">The docket is quiet. Come back in an hour.</li>
            ) : (
              liveCases.map((c) => <DocketCard key={c.caseId} c={c} />)
            )}
          </ul>
        </div>
      </section>

      {/* SECTION 2 — HOW IT WORKS */}
      <section className="border-b border-c-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">Every Story Gets a Verdict</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ["Spill.", "Tell it your way. An interviewer draws the story out of you — it never writes a word for you."],
              ["Judgment.", "Thousands of strangers vote: guilty, not guilty, red flag, run. The verdict locks on a deadline."],
              ["The Outcome.", "Months later, you come back and tell the court what actually happened. That part matters most."],
            ].map(([head, body], i) => (
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
      <section className="border-b border-c-border">
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
      <section className="border-b border-c-border">
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

function DocketCard({ c }: { c: LiveCase }) {
  return (
    <li className="rounded-md border border-c-border bg-c-surface-2 p-4">
      <Link to="/post/$postId" params={{ postId: c.postId }} className="block group">
        <div className="text-[10px] uppercase tracking-wider text-c-text-3">{c.courtBadge}</div>
        <div className="mt-2 font-serif text-base leading-snug text-c-text-1 group-hover:underline underline-offset-4">
          {c.title}
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-c-surface-3">
          <div
            className="h-full bg-c-text-1"
            style={{ width: `${Math.max(4, c.topVerdictPct)}%` }}
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
      <Link to="/post/$postId" params={{ postId: c.postId }} className="block group">
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

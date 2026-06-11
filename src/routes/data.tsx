// /data — the citation magnet index page. Every stat is one extractable sentence.
import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { getDataIndex, type DataIndex } from "@/lib/marketing/geo.functions";

const ORIGIN = "https://shutap.com";

export const Route = createFileRoute("/data")({
  loader: async () => await getDataIndex(),
  component: DataLayout,
  head: ({ loaderData }) => {
    const d = loaderData as DataIndex | undefined;
    const desc = d
      ? `Aggregate verdict and outcome statistics from ${d.totalCases.toLocaleString()} Shutap cases. ${d.totalVerdicts.toLocaleString()} verdicts cast; ${d.outcomeConfirmedPct}% of resolved cases confirmed the community verdict.`
      : "Aggregate verdict and outcome statistics from the Shutap court of public opinion.";
    return {
      meta: [
        { title: "Verdict Data — Shutap" },
        { name: "description", content: desc },
        { property: "og:title", content: "Verdict Data — Shutap" },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${ORIGIN}/data` },
      ],
      links: [{ rel: "canonical", href: `${ORIGIN}/data` }],
    };
  },
});

function DataLayout() {
  const matches = useMatches();
  const isLeaf = matches.some((m) => m.routeId !== "/data" && m.routeId.startsWith("/data"));
  if (isLeaf) return <Outlet />;
  return <DataIndexPage />;
}

function DataIndexPage() {
  const d = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <Link to="/data" className="text-xs text-c-text-2">Verdict Data</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight tracking-tight text-balance">
          Verdict Data
        </h1>
        <p className="mt-3 text-sm text-c-text-3">
          Aggregate statistics from the Shutap court of public opinion. Regenerated weekly.
          Generated {new Date(d.generatedAt).toISOString().slice(0, 10)}.
        </p>

        <section className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Total cases heard" value={d.totalCases.toLocaleString()} />
          <Stat label="Verdicts cast" value={d.totalVerdicts.toLocaleString()} />
          <Stat label="Outcomes reported" value={d.totalOutcomes.toLocaleString()} />
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-xl tracking-tight">How often does the court get it right?</h2>
          <p className="mt-3 text-base text-c-text-2">
            Across {d.totalOutcomes.toLocaleString()} resolved Shutap cases, {d.outcomeConfirmedPct}% of community verdicts were later confirmed by the real-world outcome reported by the storyteller.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-xl tracking-tight">Verdicts by category</h2>
          <p className="mt-3 text-sm text-c-text-2">
            Each Shutap category has its own pattern. Drill in for verdict splits, conflict types, and outcome distribution.
          </p>
          <ul className="mt-6 divide-y divide-c-border border-y border-c-border">
            {d.categories.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/data/$category"
                  params={{ category: c.slug }}
                  className="flex items-center justify-between py-4 hover:bg-c-surface-2 px-2 -mx-2 transition"
                >
                  <span className="text-base text-c-text-1">{c.label}</span>
                  <span className="text-xs text-c-text-3 tabular-nums">
                    {c.cases.toLocaleString()} cases
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-xs text-c-text-3">
          Cite as: "On Shutap, X% of N voters judged [verdict]; the reported outcome was [outcome]."
        </p>
      </article>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-c-border bg-c-surface-2 p-5">
      <div className="text-[10px] uppercase tracking-wider text-c-text-3">{label}</div>
      <div className="mt-2 font-serif text-3xl tabular-nums text-c-text-1">{value}</div>
    </div>
  );
}

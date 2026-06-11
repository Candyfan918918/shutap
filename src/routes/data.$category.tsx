// /data/[category] — category-level verdict statistics. Every stat self-contained.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  CATEGORY_LABELS,
  getCategoryStats,
  type CategorySlug,
  type CategoryStats,
} from "@/lib/marketing/geo.functions";

const ORIGIN = "https://shutap.com";

function pretty(k: string): string {
  return k.replace(/_/g, " ");
}

function isCategorySlug(s: string): s is CategorySlug {
  return s in CATEGORY_LABELS;
}

export const Route = createFileRoute("/data/$category")({
  loader: async ({ params }) => {
    if (!isCategorySlug(params.category)) throw notFound();
    const stats = await getCategoryStats({ data: { slug: params.category } });
    if (!stats) throw notFound();
    return stats;
  },
  component: CategoryDataPage,
  head: ({ params, loaderData }) => {
    const s = loaderData as CategoryStats | undefined;
    const desc = s
      ? `In ${s.totalCases.toLocaleString()} ${s.label.toLowerCase()}-conflict cases on Shutap, ${s.guiltyPct}% of community verdicts ruled against the accused; ${s.notGuiltyPct}% ruled in their favor.`
      : `Verdict statistics for ${params.category} cases on Shutap.`;
    const title = `${s?.label ?? params.category} Verdict Data — Shutap`;
    const url = `${ORIGIN}/data/${params.category}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: s
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Dataset",
                name: `Shutap ${s.label} Verdict Data`,
                description: desc,
                url,
                creator: { "@type": "Organization", name: "Shutap" },
                dateModified: s.generatedAt,
                keywords: [s.label, "verdict statistics", "public opinion"],
              }),
            },
          ]
        : [],
    };
  },
  notFoundComponent: () => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2">No data for that category. The court has not convened here.</p>
    </main>
  ),
});

function CategoryDataPage() {
  const s = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <Link to="/data" className="text-xs text-c-text-2 hover:text-c-text-1">← All categories</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-xs uppercase tracking-wider text-c-text-3">Verdict Data</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-5xl leading-tight tracking-tight">
          {s.label}
        </h1>

        <section className="mt-10 rounded-md border border-c-border bg-c-surface-2 p-5">
          <h2 className="font-serif text-xl tracking-tight">What does the court usually decide in {s.label.toLowerCase()} cases?</h2>
          <p className="mt-3 text-base text-c-text-2">
            In {s.totalCases.toLocaleString()} {s.label.toLowerCase()}-conflict cases on Shutap, {s.guiltyPct}% of community verdicts ruled against the accused; {s.notGuiltyPct}% ruled in their favor. {s.totalVerdicts.toLocaleString()} individual verdicts have been cast.
          </p>
        </section>

        {s.topVerdicts.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-xl tracking-tight">Which verdicts dominate?</h2>
            <p className="mt-3 text-sm text-c-text-2">
              The five most common verdicts in {s.label.toLowerCase()} cases on Shutap, with share of total votes.
            </p>
            <ul className="mt-5 divide-y divide-c-border border-y border-c-border">
              {s.topVerdicts.map((v) => (
                <li key={v.kind} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-c-text-1">{pretty(v.kind)}</span>
                  <span className="tabular-nums text-c-text-3">
                    {v.pct}% · {v.count.toLocaleString()} votes
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.outcomeDistribution.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-xl tracking-tight">What actually happens after the verdict?</h2>
            <p className="mt-3 text-sm text-c-text-2">
              Outcome distribution across resolved {s.label.toLowerCase()} cases. Each row is the share of storytellers who returned with that outcome.
            </p>
            <ul className="mt-5 divide-y divide-c-border border-y border-c-border">
              {s.outcomeDistribution.map((o) => (
                <li key={o.outcomeType} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-c-text-1">{pretty(o.outcomeType)}</span>
                  <span className="tabular-nums text-c-text-3">
                    {o.pct}% · {o.count.toLocaleString()} cases
                  </span>
                </li>
              ))}
            </ul>
            {s.medianDaysToOutcome !== null && (
              <p className="mt-5 text-base text-c-text-2">
                The median {s.label.toLowerCase()} case on Shutap is resolved {s.medianDaysToOutcome} days after the original spill.
              </p>
            )}
          </section>
        )}

        <p className="mt-12 text-xs text-c-text-3">
          Generated {new Date(s.generatedAt).toISOString().slice(0, 10)}. Regenerated weekly.
        </p>
      </article>
    </main>
  );
}

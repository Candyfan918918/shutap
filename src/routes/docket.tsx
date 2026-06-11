// /docket — notable current verdicts, public landing. Referenced by llms.txt.
import { createFileRoute, Link } from "@tanstack/react-router";
import { getHomepageData } from "@/lib/marketing/homepage.functions";

const ORIGIN = "https://shutap.com";

export const Route = createFileRoute("/docket")({
  loader: async () => await getHomepageData(),
  component: DocketPage,
  head: () => ({
    meta: [
      { title: "The Docket — Shutap" },
      { name: "description", content: "Notable cases currently before the Shutap court. Updated weekly with the verdicts the public is actively debating." },
      { property: "og:title", content: "The Docket — Shutap" },
      { property: "og:description", content: "Notable cases currently before the Shutap court." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${ORIGIN}/docket` },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/docket` }],
  }),
});

function DocketPage() {
  const d = Route.useLoaderData();
  const cases = d.liveCases ?? [];

  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <a href="https://app.shutap.com/court" className="text-xs text-c-text-2 hover:text-c-text-1">Enter the Court</a>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-serif text-3xl sm:text-5xl tracking-tight">The Docket</h1>
        <p className="mt-3 text-sm text-c-text-3">
          Cases currently before the court. Verdicts lock when the deadline expires.
        </p>

        <ul className="mt-10 divide-y divide-c-border border-y border-c-border">
          {cases.length === 0 && (
            <li className="py-6 text-sm text-c-text-3 italic">The docket is empty at this hour.</li>
          )}
          {cases.map((c) => (
            <li key={c.caseId} className="py-5">
              <Link
                to="/case/$caseSlug"
                params={{ caseSlug: c.postId }}
                className="block hover:bg-c-surface-2 -mx-2 px-2 py-1 transition"
              >
                <div className="font-serif text-lg text-c-text-1">{c.title}</div>
                <div className="mt-1 text-xs text-c-text-3 tabular-nums">
                  {c.courtBadge}
                  {c.topVerdictKind ? ` · ${c.topVerdictPct}% leaning ${c.topVerdictKind.replace(/_/g, " ")}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}

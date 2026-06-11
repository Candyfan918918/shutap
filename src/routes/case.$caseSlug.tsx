// AEO-optimized public case page at /case/$caseSlug (slug = post UUID).
// Order of sections IS the optimization — answer-first, then story, then schema.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getCasePage, type CasePageData } from "@/lib/marketing/case-page.functions";

const ORIGIN = "https://shutap.com";
const APP = "https://app.shutap.com";

function pretty(k: string | null): string {
  if (!k) return "no verdict";
  return k.replace(/_/g, " ");
}

function caseBrief(d: CasePageData): string {
  const base = `${d.questionBeforeCourt} — ${d.dominantVerdictPct}% of ${d.totalVotes.toLocaleString()} people voted ${pretty(d.dominantVerdict)}.`;
  if (d.outcomeType) {
    return `${base} ${d.daysToOutcome ?? 0} days later: ${d.outcomeType.replace(/_/g, " ")}.`;
  }
  return base;
}

function acceptedAnswerText(d: CasePageData): string {
  const head = `${d.dominantVerdictPct}% of ${d.totalVotes.toLocaleString()} people voted ${pretty(d.dominantVerdict)}.`;
  const bench = d.benchVerdictLine ? ` ${d.benchVerdictLine}` : "";
  const outcome = d.outcomeType
    ? ` ${d.daysToOutcome ?? 0} days later, the storyteller returned: ${d.outcomeType.replace(/_/g, " ")}${d.outcomeDetail ? " — " + d.outcomeDetail : ""}.`
    : "";
  return `${head}${bench}${outcome}`.trim();
}

export const Route = createFileRoute("/case/$caseSlug")({
  loader: async ({ params }) => {
    const d = await getCasePage({ data: { postId: params.caseSlug } });
    if (!d) throw notFound();
    return d;
  },
  component: CasePage,
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Case — Shutap" }] };
    const d = loaderData;
    const url = `${ORIGIN}/case/${params.caseSlug}`;
    const desc = caseBrief(d);
    const story200 = d.storyText.length > 200 ? d.storyText.slice(0, 200) + "…" : d.storyText;

    const qaPage = {
      "@context": "https://schema.org",
      "@type": "QAPage",
      mainEntity: {
        "@type": "Question",
        name: d.questionBeforeCourt,
        text: story200,
        answerCount: d.totalVotes,
        datePublished: d.createdAt,
        author: { "@type": "Person", name: d.alias },
        acceptedAnswer: {
          "@type": "Answer",
          text: acceptedAnswerText(d),
          upvoteCount: d.dominantVerdictCount,
          datePublished: d.verdictLockAt ?? d.createdAt,
        },
        suggestedAnswer: d.counselComments.slice(0, 2).map((c) => ({
          "@type": "Answer",
          text: c.body,
          upvoteCount: c.likeCount,
          author: { "@type": "Person", name: c.alias },
        })),
      },
    };

    const forumPosting = {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      headline: d.caseTitle,
      text: d.storyText,
      author: { "@type": "Person", name: d.alias },
      datePublished: d.createdAt,
      dateModified: d.updatedAt,
      url,
      interactionStatistic: [
        { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: d.commentCount },
        { "@type": "InteractionCounter", interactionType: "https://schema.org/VoteAction", userInteractionCount: d.totalVotes },
      ],
      comment: d.counselComments.slice(0, 3).map((c) => ({
        "@type": "Comment",
        text: c.body,
        author: { "@type": "Person", name: c.alias },
      })),
    };

    const scripts: Array<{ type: string; children: string }> = [
      { type: "application/ld+json", children: JSON.stringify(qaPage) },
      { type: "application/ld+json", children: JSON.stringify(forumPosting) },
    ];

    if (d.outcomeType) {
      const faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What did the community decide?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `${d.dominantVerdictPct}% of ${d.totalVotes.toLocaleString()} verdicts: ${pretty(d.dominantVerdict)}.${d.benchVerdictLine ? " " + d.benchVerdictLine : ""}`,
            },
          },
          {
            "@type": "Question",
            name: "What actually happened?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `${d.daysToOutcome ?? 0} days later: ${d.outcomeType.replace(/_/g, " ")}${d.outcomeDetail ? " — " + d.outcomeDetail : ""}.`,
            },
          },
        ],
      };
      scripts.push({ type: "application/ld+json", children: JSON.stringify(faq) });
    }

    return {
      meta: [
        { title: `${d.caseTitle} — Shutap` },
        { name: "description", content: desc },
        { property: "og:title", content: d.caseTitle },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: d.createdAt },
        { property: "article:modified_time", content: d.updatedAt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: d.caseTitle },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  errorComponent: ({ error }) => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2 max-w-md text-center">The bench is unavailable. {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2">This case doesn't exist. Or it was retracted. The Bench is saying nothing.</p>
    </main>
  ),
});

function CasePage() {
  const d = Route.useLoaderData() as CasePageData;
  const brief = caseBrief(d);

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight text-c-text-1">Shutap</Link>
          <a href={`${APP}/court`} className="text-xs text-c-text-2 hover:text-c-text-1">Enter the Court</a>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        {/* 1. H1 */}
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight tracking-tight text-balance">
          {d.caseTitle}
        </h1>
        <p className="mt-3 text-xs text-c-text-3 tabular-nums">
          Filed by {d.alias} · {new Date(d.createdAt).toISOString().slice(0, 10)}
          {d.conflictType ? ` · ${d.conflictType.replace(/_/g, " ")}` : null}
        </p>

        {/* 2. CASE BRIEF */}
        <aside
          aria-label="Case brief"
          className="mt-8 rounded-md border border-c-border bg-c-surface-2 p-5 text-sm leading-relaxed text-c-text-1"
        >
          <div className="text-[10px] uppercase tracking-wider text-c-text-3 mb-2">Case brief</div>
          {brief}
        </aside>

        {/* 3. SITUATION */}
        <section className="mt-10">
          <h2 className="font-serif text-xl tracking-tight text-c-text-1">Situation</h2>
          <div className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-c-text-2">
            {d.storyText || <span className="italic text-c-text-3">No story body recorded.</span>}
          </div>
        </section>

        {/* 4. QUESTION */}
        <section className="mt-10">
          <h2 className="font-serif text-xl tracking-tight text-c-text-1">Question Before the Court</h2>
          <p className="mt-3 font-serif text-lg text-c-text-1">{d.questionBeforeCourt}</p>
        </section>

        {/* 5. COMMUNITY VERDICT */}
        <section className="mt-10">
          <h2 className="font-serif text-xl tracking-tight text-c-text-1">Community Verdict</h2>
          <p className="mt-3 text-sm text-c-text-2">
            <span className="font-medium text-c-text-1 tabular-nums">{d.dominantVerdictPct}%</span> voted{" "}
            <span className="font-medium text-c-text-1">{pretty(d.dominantVerdict)}</span>{" "}
            <span className="text-c-text-3">({d.totalVotes.toLocaleString()} verdicts)</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-c-surface-3" aria-hidden="true">
            <div className="h-full bg-c-text-1" style={{ width: `${Math.max(2, d.dominantVerdictPct)}%` }} />
          </div>
          {(d.majorityTheme || d.minorityTheme) && (
            <ul className="mt-5 space-y-2 text-sm text-c-text-2">
              {d.majorityTheme ? <li>· Majority reasoning: {d.majorityTheme}</li> : null}
              {d.minorityTheme ? <li>· Minority reasoning: {d.minorityTheme}</li> : null}
              {d.benchVerdictLine ? <li className="italic text-c-text-3">· The bench: {d.benchVerdictLine}</li> : null}
            </ul>
          )}
        </section>

        {/* 6. REACTION */}
        {d.topReactionKind && (
          <section className="mt-10">
            <h2 className="font-serif text-xl tracking-tight text-c-text-1">Community Reaction</h2>
            <p className="mt-3 text-sm text-c-text-2 tabular-nums">
              <span className="font-medium text-c-text-1">{d.topReactionPct}%</span> said{" "}
              <span className="font-medium text-c-text-1">{pretty(d.topReactionKind)}</span>.
            </p>
          </section>
        )}

        {/* 7. OUTCOME */}
        {d.outcomeType && (
          <section className="mt-10">
            <h2 className="font-serif text-xl tracking-tight text-c-text-1">
              What Actually Happened ({d.daysToOutcome ?? 0} days later)
            </h2>
            <p className="mt-3 text-sm text-c-text-2">
              <span className="font-medium text-c-text-1">{d.outcomeType.replace(/_/g, " ")}.</span>
              {d.outcomeDetail ? ` ${d.outcomeDetail}` : null}
            </p>
          </section>
        )}

        {/* 8. PATTERN */}
        {d.patternStat && (
          <section className="mt-10 rounded-md border border-c-border bg-c-surface-2 p-5">
            <h2 className="font-serif text-xl tracking-tight text-c-text-1">The Court's Pattern</h2>
            <p className="mt-3 text-sm text-c-text-2">
              Across <span className="text-c-text-1 font-medium tabular-nums">{d.patternStat.totalSimilar}</span> similar{" "}
              {d.conflictType?.replace(/_/g, " ") ?? "court"} cases on Shutap,{" "}
              <span className="text-c-text-1 font-medium tabular-nums">{d.patternStat.agreedPct}%</span> of verdicts agreed with the storyteller.
            </p>
          </section>
        )}

        {/* 9. SIMILAR */}
        {d.similarCases.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-xl tracking-tight text-c-text-1">Similar Cases</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {d.similarCases.map((s) => (
                <li key={s.postId}>
                  <Link
                    to="/case/$caseSlug"
                    params={{ caseSlug: s.postId }}
                    className="text-c-text-2 hover:text-c-text-1 underline underline-offset-4"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 10. CTA */}
        <section className="mt-14 border-t border-c-border pt-10">
          <p className="font-serif text-xl text-c-text-1">Have a story like this? The court will hear it.</p>
          <a
            href={`${APP}/spill`}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-c-text-1 px-5 py-3 text-sm font-medium text-c-surface hover:opacity-90 transition"
          >
            Open a case anonymously →
          </a>
        </section>
      </article>

      <footer className="border-t border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-c-text-3">
          18+ · Anonymous · Real verdicts · Real outcomes
        </div>
      </footer>
    </div>
  );
}

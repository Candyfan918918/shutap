// Sitewide metatag system for Shutap. Every page's <head> is generated from
// templates here — no hand-written meta should live in route files.
//
// Per Step 12.5 spec:
//   - title hard limit: 60 chars (truncate dynamic input with …)
//   - meta description hard limit: 155 chars
//   - og:title = title without " | Shutap" suffix
//   - og:description = meta description
//   - og:image = /api/og/case/[id] on case pages; brand card elsewhere
//   - canonical: self; query params stripped; paginated pages canonical to self
//   - robots: matrix below

export const ORIGIN = "https://shutap.com";
export const BRAND_OG_IMAGE = `${ORIGIN}/og-default.png`; // 1200x630 brand card
export const SITE_NAME = "Shutap";

// ---------- helpers ----------

export function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  // Word-aware cut, append ellipsis (1 char). Reserve 1 char for the …
  const cut = t.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:!?\-—]+$/u, "") + "…";
}

export function clampDesc(s: string): string {
  return truncate(s, 155);
}

export function clampTitle(s: string): string {
  return truncate(s, 60);
}

export function cleanCanonical(path: string): string {
  // Strip query/hash. Always self-canonical, never collapse pagination.
  const noHash = path.split("#")[0];
  const noQuery = noHash.split("?")[0];
  return noQuery.startsWith("http") ? noQuery : `${ORIGIN}${noQuery}`;
}

type RobotsState =
  | "index,follow"
  | "noindex,follow"
  | "noindex,nofollow";

export type MetaSpec = {
  title: string; // full title (with " | Shutap" if applicable)
  description: string;
  canonical: string;
  ogType?: "website" | "article";
  ogImage?: string;
  robots?: RobotsState;
  publishedTime?: string;
  modifiedTime?: string;
  jsonLd?: unknown[];
};

export type HeadReturn = {
  meta: Array<Record<string, string>>;
  links: Array<Record<string, string>>;
  scripts: Array<{ type: string; children: string }>;
};

export function buildHead(spec: MetaSpec): HeadReturn {
  const title = clampTitle(spec.title);
  const description = clampDesc(spec.description);
  const ogTitle = title.replace(/\s*\|\s*Shutap\s*$/u, "").trim() || title;
  const ogType = spec.ogType ?? "website";
  const ogImage = spec.ogImage ?? BRAND_OG_IMAGE;
  const canonical = cleanCanonical(spec.canonical);
  const robots = spec.robots ?? "index,follow";

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: robots },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_US" },
    { property: "og:type", content: ogType },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: ogImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];

  if (spec.publishedTime) {
    meta.push({ property: "article:published_time", content: spec.publishedTime });
  }
  if (spec.modifiedTime) {
    meta.push({ property: "article:modified_time", content: spec.modifiedTime });
  }

  const links: Array<Record<string, string>> = [
    { rel: "canonical", href: canonical },
  ];

  const scripts: Array<{ type: string; children: string }> =
    (spec.jsonLd ?? []).map((obj) => ({
      type: "application/ld+json",
      children: JSON.stringify(obj),
    }));

  return { meta, links, scripts };
}

// ---------- templated heads (per spec) ----------

export const headHome = (totalVerdicts?: number): HeadReturn => {
  const orgGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${ORIGIN}/#org`,
        name: "Shutap",
        url: ORIGIN,
        logo: `${ORIGIN}/logo.png`,
        description:
          "Shutap is the anonymous court of public opinion. Real people share real conflicts; the community delivers a verdict; the author reports what actually happened.",
        foundingDate: "2026",
        sameAs: [
          "https://x.com/Shutap",
          "https://www.instagram.com/shutap",
          "https://www.tiktok.com/@shutap",
          "https://www.linkedin.com/company/shutap",
        ],
      },
      {
        "@type": "WebSite",
        url: ORIGIN,
        name: "Shutap",
        publisher: { "@id": `${ORIGIN}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${ORIGIN}/search?q={query}`,
          },
          "query-input": "required name=query",
        },
        ...(typeof totalVerdicts === "number"
          ? { description: `${totalVerdicts.toLocaleString()} verdicts cast. Zero real names. Ever.` }
          : {}),
      },
    ],
  };
  return buildHead({
    title: "Shutap — Anonymous Stories, Verdicts, Real Outcomes",
    description:
      "Shutap is the anonymous court of public opinion. Share what happened, get a verdict from thousands of real people, and report what happened next.",
    canonical: `${ORIGIN}/`,
    ogType: "website",
    jsonLd: [orgGraph],
  });
};

export type CaseHeadInput = {
  caseId: string;
  caseTitle: string;
  questionBeforeCourt: string;
  dominantVerdict: string; // raw enum, e.g. "guilty"
  dominantVerdictPct: number;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
  hasOutcome: boolean;
  outcomeDays?: number | null;
  // robots inputs
  isCourtNominated?: boolean;
  isDisputedOrPaused?: boolean;
};

function prettyVerdict(k: string): string {
  return (k ?? "no verdict").replace(/_/g, " ");
}

export function headCase(input: CaseHeadInput): HeadReturn {
  const verdict = prettyVerdict(input.dominantVerdict);
  const pct = input.dominantVerdictPct;
  // Title template branches
  let title: string;
  if (input.hasOutcome) {
    title = `${truncate(input.caseTitle, 34)} — Verdict & Outcome | Shutap`;
  } else {
    title = `${truncate(input.caseTitle, 38)} — ${pct}% ${verdict} | Shutap`;
  }
  // Description template
  const q = truncate(input.questionBeforeCourt, 70);
  const tail = input.hasOutcome && input.outcomeDays != null
    ? ` See what happened ${input.outcomeDays} days later.`
    : "";
  const description = `${q} ${pct}% of ${input.totalVotes.toLocaleString()} people said ${verdict}.${tail} Full case on Shutap.`;

  // Robots matrix
  let robots: RobotsState;
  if (input.isDisputedOrPaused) robots = "noindex,nofollow";
  else if (input.totalVotes >= 25 || input.isCourtNominated) robots = "index,follow";
  else robots = "noindex,follow";

  return buildHead({
    title,
    description,
    canonical: `${ORIGIN}/case/${input.caseId}`,
    ogType: "article",
    ogImage: `${ORIGIN}/api/public/og/case/${input.caseId}`,
    robots,
    publishedTime: input.createdAt,
    modifiedTime: input.updatedAt,
  });
}

export function headCategoryCourt(label: string, slug: string, cases: number): HeadReturn {
  const robots: RobotsState = cases < 8 ? "noindex,follow" : "index,follow";
  return buildHead({
    title: `${label} Court — Real Cases & Verdicts | Shutap`,
    description: `Real ${label.toLowerCase()} conflicts judged by thousands. See live cases, locked verdicts, and what actually happened. The ${label} Court is in session.`,
    canonical: `${ORIGIN}/court/${slug}`,
    robots,
  });
}

export function headCityCourt(city: string, slug: string, cases: number): HeadReturn {
  const robots: RobotsState = cases < 10 ? "noindex,follow" : "index,follow";
  return buildHead({
    title: `${city} Court — Cases In Session | Shutap`,
    description: `Cases being judged in ${city} right now. Real local stories, live verdicts, real outcomes. ${city} Court is in session on Shutap.`,
    canonical: `${ORIGIN}/court/city/${slug}`,
    robots,
  });
}

export function headSituation(conflictTypeLabel: string, slug: string, cases: number): HeadReturn {
  const robots: RobotsState = cases < 8 ? "noindex,follow" : "index,follow";
  return buildHead({
    title: `${conflictTypeLabel} Stories & Verdicts | Shutap`,
    description: `Real ${conflictTypeLabel.toLowerCase()} stories judged by thousands. Live verdicts and real outcomes from the Shutap court.`,
    canonical: `${ORIGIN}/situation/${slug}`,
    robots,
  });
}

// Fixed pages
export const headAmIWrong = (): HeadReturn =>
  buildHead({
    title: "Am I Wrong? Get a Real Community Verdict | Shutap",
    description:
      "Spill the situation, anonymously. Thousands of real people deliver a verdict in days. Then come back and tell the court what actually happened.",
    canonical: `${ORIGIN}/am-i-wrong`,
  });

export const headOutcomes = (): HeadReturn =>
  buildHead({
    title: "What Actually Happened — Real Outcomes | Shutap",
    description:
      "Resolved Shutap cases — what the community voted versus what actually happened. Every outcome reported by the original storyteller.",
    canonical: `${ORIGIN}/outcomes`,
  });

export const headData = (totalCases?: number, totalVerdicts?: number, outcomeConfirmedPct?: number): HeadReturn => {
  const desc = totalCases != null && totalVerdicts != null && outcomeConfirmedPct != null
    ? `Aggregate verdict and outcome statistics from ${totalCases.toLocaleString()} Shutap cases. ${totalVerdicts.toLocaleString()} verdicts cast; ${outcomeConfirmedPct}% of resolved cases confirmed the community verdict.`
    : "Aggregate verdict and outcome statistics from the Shutap court of public opinion.";
  return buildHead({
    title: "Verdict Data — What the Public Judges | Shutap",
    description: desc,
    canonical: `${ORIGIN}/data`,
  });
};

export const headAbout = (): HeadReturn =>
  buildHead({
    title: "About Shutap — The Memory of Human Experience",
    description:
      "Shutap is the anonymous court of public opinion. Real conflicts, real verdicts, real outcomes — preserved as a permanent public record.",
    canonical: `${ORIGIN}/about`,
  });

export const headDocket = (): HeadReturn =>
  buildHead({
    title: "The Docket — Cases Before The Court | Shutap",
    description:
      "Notable cases currently before the Shutap court. Updated weekly with the verdicts the public is actively debating.",
    canonical: `${ORIGIN}/docket`,
  });

// Internal / app routes — never index
export const headNoindex = (canonicalPath: string, title: string, description: string): HeadReturn =>
  buildHead({
    title,
    description,
    canonical: canonicalPath.startsWith("http") ? canonicalPath : `${ORIGIN}${canonicalPath}`,
    robots: "noindex,follow",
  });

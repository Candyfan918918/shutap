import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  listCourtCases,
  getViewerRegion,
  getMyStreak,
  type CourtCase,
} from "@/lib/court.functions";
import { CourtCaseCard } from "@/components/court/CourtCaseCard";
import { CourtTabs, type CourtTab, type CourtCategory } from "@/components/court/CourtTabs";
import { CaseFlow } from "@/components/court/CaseFlow";
import { WatchParty, shouldShowWatchParty } from "@/components/court/WatchParty";

export const Route = createFileRoute("/court")({
  component: CourtPage,
  head: () => ({
    meta: [
      { title: "👑 Relationship Court™ — Where the internet decides" },
      {
        name: "description",
        content:
          "Live community trials. Global, country, and local Courts. Vote, debate, watch the verdict land. Real stories, real countdown, real consequences.",
      },
      { property: "og:title", content: "👑 Relationship Court™" },
      { property: "og:description", content: "Where the internet decides." },
      { property: "og:type", content: "website" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-4">
      <p className="text-sm text-muted-foreground">The court is in recess.</p>
      <p className="text-xs text-muted-foreground/70 break-words">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
      >
        Reconvene
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-sm text-muted-foreground">No case file under that docket.</p>
    </div>
  ),
});

function CourtPage() {
  const fetchRegion = useServerFn(getViewerRegion);
  const fetchCases = useServerFn(listCourtCases);

  const regionQuery = useQuery({
    queryKey: ["court", "viewer-region"],
    queryFn: () => fetchRegion(),
    staleTime: 5 * 60_000,
  });

  const [tab, setTab] = useState<CourtTab>("world");
  const [category, setCategory] = useState<CourtCategory>("all");
  // Once region resolves, default to country if available.
  useEffect(() => {
    if (regionQuery.data?.country) setTab("country");
  }, [regionQuery.data?.country]);

  const scopeForTab = (t: CourtTab): { scope: "world" | "country" | "city"; regionCode: string } => {
    if (t === "near") {
      // No city resolution yet → fall back to country, then world
      return regionQuery.data?.country
        ? { scope: "country", regionCode: regionQuery.data.country }
        : { scope: "world", regionCode: "WORLD" };
    }
    if (t === "country") {
      return regionQuery.data?.country
        ? { scope: "country", regionCode: regionQuery.data.country }
        : { scope: "world", regionCode: "WORLD" };
    }
    return { scope: "world", regionCode: "WORLD" };
  };

  const { scope, regionCode } = scopeForTab(tab);

  const casesQuery = useQuery({
    queryKey: ["court", "cases", scope, regionCode],
    queryFn: () =>
      fetchCases({
        data: { scope, regionCode, limit: 30 },
      }),
    staleTime: 30_000,
  });

  const cases = casesQuery.data ?? [];
  const filtered = useMemo(() => {
    if (category === "all") return cases;
    return cases.filter((c) => {
      const cat = c.post?.scoreCategory?.toLowerCase() ?? "";
      return cat.includes(category);
    });
  }, [cases, category]);

  const grouped = useMemo(() => {
    const inCourt = filtered.filter((c) => c.status === "in_court");
    const pending = filtered.filter((c) => c.status === "judgment_pending");
    const nominated = filtered.filter((c) => c.status === "nominated");
    const decided = filtered.filter((c) => c.status === "decided" || c.status === "legendary");
    return { inCourt, pending, nominated, decided };
  }, [filtered]);

  const featured = grouped.inCourt[0] ?? grouped.decided[0] ?? grouped.nominated[0] ?? null;

  const countryLabel = regionQuery.data?.country
    ? regionQuery.data.countryLabel
    : "🌐 Country";

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-24">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-2.5 flex items-center justify-between">
          <Link to="/stream" className="text-[17px] font-medium tracking-tight">
            shut<span className="text-c-pink-deep">ap</span>
          </Link>
          <span className="live-pill"><span className="live-pill__dot" />Family Court · Live</span>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-border">
        {/* Hero — soft palette: cream surface, pink-deep ink, ghost wordmark in pink-soft */}
        <section className="relative overflow-hidden text-center px-4 pt-6 pb-5 bg-c-surface-2 border-b border-c-border">
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-[-10px] text-[88px] font-medium text-c-pink-soft/70 whitespace-nowrap pointer-events-none tracking-tighter select-none"
          >
            COURT
          </span>
          <div className="relative text-[10px] font-medium tracking-[0.12em] uppercase text-c-pink-deep mb-2">
            Relationship Court™ · Where the human decides
          </div>
          <h1 className="relative text-[16px] font-medium text-c-text-1 leading-snug mb-1.5 text-balance">
            The cases the algorithm couldn't ignore.
          </h1>
          <p className="relative text-[12px] italic text-c-text-2 leading-snug">
            What would you do if you were her?
          </p>
          <span className="relative inline-flex items-center gap-1.5 mt-3 bg-c-surface border border-c-pink-border rounded-full px-2.5 py-1 text-[11px] text-c-pink-deep font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-c-pink-deep animate-pulse" />
            Live deliberations
          </span>
        </section>

        <div className="px-4 pt-6 space-y-6">




        <CourtTabs
          value={tab}
          onChange={setTab}
          countryLabel={countryLabel}
          category={category}
          onCategoryChange={setCategory}
        />

        {casesQuery.isLoading && (
          <p className="text-center text-sm text-muted-foreground">Calling court to order…</p>
        )}

        {!casesQuery.isLoading && cases.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-base font-medium">Court is in recess in {regionCode}.</p>
            <p className="text-sm text-muted-foreground mt-1">
              No cases yet. Try {tab !== "world" ? "World" : "another region"} — or file your own.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {tab !== "world" && (
                <button
                  onClick={() => setTab("world")}
                  className="px-4 py-2 rounded-full border border-border text-sm hover:border-primary/40"
                >
                  🌎 Switch to World
                </button>
              )}
              <Link
                to="/spill"
                className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-medium text-sm"
              >
                ✍️ File a case
              </Link>
            </div>
          </div>
        )}

        {featured && shouldShowWatchParty(featured) && <WatchParty c={featured} />}

        {featured && <CaseFlow c={featured} />}

        {grouped.inCourt.length > 1 && (
          <Section
            title="⚖️ In Court"
            subtitle="Countdown is live. Cast your verdict."
            items={grouped.inCourt.slice(1)}
          />
        )}

        {grouped.pending.length > 0 && (
          <Section
            title="⏳ Judgment Pending"
            subtitle="The jury deliberates."
            items={grouped.pending}
          />
        )}

        {grouped.nominated.length > 0 && (
          <Section
            title="👀 Nominated"
            subtitle="Trending stories knocking on Court's door."
            items={grouped.nominated}
            small
          />
        )}

        {grouped.decided.length > 0 && (
          <Section
            title="👑 Final Decisions"
            subtitle="The world has spoken."
            items={grouped.decided}
          />
        )}
        </div>
      </main>
    </div>
  );
}


function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  small = false,
}: {
  title: string;
  subtitle?: string;
  items: CourtCase[];
  small?: boolean;
}) {
  return (
    <section>
      <SectionTitle title={title} subtitle={subtitle} />
      <div className={`grid gap-3 ${small ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        {items.map((c, i) => (
          <CourtCaseCard key={c.id} c={c} size={small ? "sm" : "md"} index={i} />
        ))}
      </div>
    </section>
  );
}

function StreakChip() {
  const fetchStreak = useServerFn(getMyStreak);
  const [streak, setStreak] = useState<{ current: number; badge: { emoji: string; label: string } | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      try {
        const s = await fetchStreak();
        if (!cancelled) setStreak({ current: s.current, badge: s.badge });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchStreak]);

  if (!streak || streak.current === 0) return <span className="text-xs text-muted-foreground">Vote daily → streak ☕</span>;
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-surface-elevated border border-border">
      {streak.badge?.emoji ?? "🔥"} {streak.current}-day streak
    </span>
  );
}

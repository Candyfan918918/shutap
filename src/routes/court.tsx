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
import { CourtTabs, type CourtTab } from "@/components/court/CourtTabs";
import { CourtroomPanel } from "@/components/court/CourtroomPanel";

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
  const grouped = useMemo(() => {
    const inCourt = cases.filter((c) => c.status === "in_court");
    const pending = cases.filter((c) => c.status === "judgment_pending");
    const nominated = cases.filter((c) => c.status === "nominated");
    const decided = cases.filter((c) => c.status === "decided" || c.status === "legendary");
    return { inCourt, pending, nominated, decided };
  }, [cases]);

  const featured = grouped.inCourt[0] ?? grouped.decided[0] ?? grouped.nominated[0] ?? null;

  const countryLabel = regionQuery.data?.country
    ? regionQuery.data.countryLabel
    : "🌐 Country";

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain pb-24">
      <header className="sticky top-0 z-30  bg-background/75 border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground">← Shutap</Link>
          <StreakChip />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl sm:text-5xl font-medium text-balance">👑 Relationship Court™</h1>
          <p className="mt-2 text-base text-muted-foreground text-balance">
            Where the <span className="text-foreground font-medium">internet</span> decides.
          </p>
        </motion.div>

        <CourtTabs value={tab} onChange={setTab} countryLabel={countryLabel} />

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

        {featured && (
          <section>
            <SectionTitle title="Featured case" subtitle="The internet is invested." />
            <CourtCaseCard c={featured} size="lg" />
          </section>
        )}

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

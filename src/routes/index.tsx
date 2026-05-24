import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { I18nProvider } from "@/lib/i18n/context";
import {
  detectBrowserLocale,
  isLocale,
  type Locale,
} from "@/lib/i18n";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { listTrendingFeed } from "@/lib/posts/feed.functions";
import { getActiveCourtCasesByPostIds } from "@/lib/court.functions";
import { FeedCard } from "@/components/posts/FeedCard";

export const Route = createFileRoute("/")({
  component: IndexShell,
  head: () => ({
    meta: [
      { title: "Shutap — spill the tea, the internet judges" },
      {
        name: "description",
        content:
          "Anonymous relationship stories. Real chaos. Real verdicts. The internet jury is in session.",
      },
      { property: "og:title", content: "Shutap — spill the tea" },
      { property: "og:description", content: "Say what you can't say anywhere else." },
      { property: "og:type", content: "website" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
});

const LOCALE_KEY = "md.locale";

function IndexShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LOCALE_KEY) : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  const change = (l: Locale) => {
    setLocale(l);
    try { window.localStorage.setItem(LOCALE_KEY, l); } catch { /* ignore */ }
  };
  return (
    <I18nProvider locale={locale}>
      <HomePage locale={locale} onLocaleChange={change} />
    </I18nProvider>
  );
}

function HomePage({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (l: Locale) => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrimaryNav locale={locale} onLocaleChange={onLocaleChange} />
      <main className="pb-32">
        <Hero />
        <TrendingTea />
        <CourtMomentum />
        <ClosingCTA />
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-5 py-10 text-center text-xs text-muted-foreground space-y-1">
          <p>Anonymous. Real stories. No advice from chatbots.</p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────── Hero ─────────────────────────────── */

const ROTATING_PROMPTS = [
  "What truth are you sitting on?",
  "Spill the tea ☕",
  "Say what you can't say elsewhere",
  "Tell us the messy truth",
  "What happened last night?",
];

function Hero() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % ROTATING_PROMPTS.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="px-5 pt-16 sm:pt-24 pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface text-xs font-semibold text-muted-foreground mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          428 people are spilling right now
        </motion.div>

        <motion.h1
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display font-bold tracking-tight text-[44px] sm:text-[64px] leading-[1.05] text-balance"
        >
          {ROTATING_PROMPTS[idx]}
        </motion.h1>

        <p className="mt-6 text-lg text-muted-foreground text-balance max-w-xl mx-auto">
          Anonymous. Unfiltered. The internet jury is listening.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-10 flex justify-center"
        >
          <Link
            to="/spill"
            className="group inline-flex items-center gap-3 px-8 sm:px-10 py-5 rounded-button bg-primary text-primary-foreground font-bold text-lg shadow-soft hover:shadow-lg hover:scale-[1.03] active:scale-95 transition"
          >
            <span className="text-2xl">☕</span>
            Spill It
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </motion.div>

        <p className="mt-5 text-xs text-muted-foreground">
          Fully anonymous. Takes 60 seconds.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Trending Tea (5–8 cards) ─────────────────────────────── */

function TrendingTea() {
  const fetchFeed = useServerFn(listTrendingFeed);
  const fetchCourt = useServerFn(getActiveCourtCasesByPostIds);

  const { data, isLoading } = useQuery({
    queryKey: ["home-trending"],
    queryFn: () => fetchFeed({ data: { limit: 6, sort: "trending" } }),
    staleTime: 60_000,
  });

  const postIds = useMemo(() => (data ?? []).map((d) => d.id), [data]);
  const courtQuery = useQuery({
    enabled: postIds.length > 0,
    queryKey: ["home-court", postIds.join(",")],
    queryFn: () => fetchCourt({ data: { postIds } }),
    staleTime: 60_000,
  });

  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight leading-tight">
              Trending tea today
            </h2>
            <p className="mt-2 text-muted-foreground text-base">
              The stories the internet can't stop talking about.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 rounded-card bg-card border border-border/60 animate-pulse" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {data.slice(0, 6).map((item, i) => (
              <FeedCard key={item.id} item={item} index={i} court={courtQuery.data?.[item.id]} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 rounded-card border border-dashed border-border">
            <p className="text-3xl mb-3">☕</p>
            <p className="font-display font-bold text-xl">Quiet today… suspicious.</p>
            <p className="text-sm text-muted-foreground mt-2">Be the first to spill.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Court Momentum ─────────────────────────────── */

function CourtMomentum() {
  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-card overflow-hidden bg-gradient-to-br from-primary/8 via-secondary/8 to-accent/12 border border-border/60 p-8 sm:p-12"
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase text-primary">
              Court in session
            </span>
          </div>

          <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight leading-tight max-w-2xl">
            The internet jury is weighing in.
          </h2>
          <p className="mt-3 text-muted-foreground text-base max-w-xl">
            Real stories. Real receipts. The community decides who's wrong — and verdicts drop on a timer.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/court"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-button bg-foreground text-background font-bold text-sm hover:scale-[1.03] active:scale-95 transition shadow-soft"
            >
              ⚖️ Enter the court
            </Link>
            <span className="text-xs text-muted-foreground">
              Next verdict drops in <span className="font-bold text-foreground">3h 12m</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Closing CTA ─────────────────────────────── */

function ClosingCTA() {
  return (
    <section className="px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-balance leading-tight">
          You're sitting on a story.
          <br />
          <span className="text-primary">We both know it.</span>
        </h2>
        <p className="mt-5 text-muted-foreground text-balance">
          No name. No face. No judgment from people who know you.
        </p>
        <Link
          to="/spill"
          className="mt-9 inline-flex items-center gap-3 px-8 py-4 rounded-button bg-primary text-primary-foreground font-bold text-base shadow-soft hover:scale-[1.03] active:scale-95 transition"
        >
          ☕ Spill it now
        </Link>
      </div>
    </section>
  );
}

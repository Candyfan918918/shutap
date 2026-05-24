import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { I18nProvider, useT } from "@/lib/i18n/context";
import {
  detectBrowserLocale,
  isLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { IdentityHeaderSlot } from "@/components/identity/IdentityHeaderSlot";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { listTrendingFeed, type FeedItem, type FeedCategory } from "@/lib/posts/feed.functions";
import { FeedCard } from "@/components/posts/FeedCard";

export const Route = createFileRoute("/")({
  component: IndexShell,
  head: () => ({
    meta: [
      { title: "Shutap — 👀 what actually happened?" },
      {
        name: "description",
        content:
          "Shutap — the world's most entertaining anonymous relationship storytelling community. Real stories, real chaos, real happy endings.",
      },
      { property: "og:title", content: "Shutap — what actually happened?" },
      { property: "og:description", content: "Anonymous. Authentic. Worldwide. Real relationship stories — no fake perfection." },
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

const BOARD_KEYS = ["chaotic", "sweet", "twist", "money", "mil", "recovery"] as const;
const DIM_KEYS = ["twist", "damage", "money", "family", "comms", "love"] as const;
const PROOF_KEYS = ["stories", "countries", "points", "survived"] as const;

function HomePage({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (l: Locale) => void }) {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      <PrimaryNav locale={locale} onLocaleChange={onLocaleChange} />
      <main className="pb-24">
        <TopTrendingWall />
        <MainCTA />
        <TrendingFeed />
        <Leaderboards />
        <HowItWorks />
        <SocialProof />
        <SoftSignup />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground space-y-1">
          <p>⚠️ {t("disclaimer")}</p>
          <p>{t("footer.made")}</p>
        </div>
      </footer>
    </div>
  );
}

function TopBar({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/75 border-b border-border">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-sm">
            👀
          </div>
          <span className="font-semibold tracking-tight">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/court"
            className="inline-flex text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/40 hover:border-primary transition font-semibold"
          >
            ⚖️ Court
          </Link>
          <IdentityHeaderSlot />
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition"
              aria-label={t("nav.language")}
            >
              🌐 {LOCALE_LABELS[locale]}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-popover p-1 shadow-xl">
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l}
                    onClick={() => { onChange(l); setOpen(false); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-elevated transition ${l === locale ? "text-primary" : ""}`}
                  >
                    {LOCALE_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero: real top trending wall ───────────────────────── */

function TopTrendingWall() {
  const { t } = useT();
  const fetchFeed = useServerFn(listTrendingFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["trending-feed", "wall"],
    queryFn: () => fetchFeed({ data: { limit: 10, sort: "trending" } }),
    staleTime: 60_000,
  });

  return (
    <section className="pt-6 sm:pt-10">
      <div className="mx-auto max-w-6xl px-4">
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-5xl font-bold tracking-tight text-balance leading-tight"
        >
          {t("wall.title")}
        </motion.h1>
        <p className="mt-2 text-muted-foreground">{t("wall.subtitle")}</p>
      </div>

      <div className="mt-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 px-4 sm:px-[max(1rem,calc(50vw-36rem))] snap-x snap-mandatory">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="snap-start shrink-0 w-[78vw] sm:w-[320px] aspect-[4/5] rounded-3xl border border-border bg-card animate-pulse" />
              ))
            : (data ?? []).map((item, i) => <WallCard key={item.id} item={item} index={i} />)}
        </div>
      </div>
    </section>
  );
}

function WallCard({ item, index }: { item: FeedItem; index: number }) {
  const location = [item.cityLabel, item.countryCode].filter(Boolean).join(" · ");
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="snap-start shrink-0 w-[78vw] sm:w-[320px] rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-card to-surface relative group"
    >
      <Link to="/post/$postId" params={{ postId: item.id }} search={{ shared: 2 }}>
        <div className="aspect-[4/5] p-5 flex flex-col justify-between relative">
          {item.mediaUrl ? (
            <img src={item.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_10%,oklch(0.62_0.22_25/_0.5),transparent_60%)]" />
          )}
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-xs px-2 py-1 rounded-full bg-background/60 backdrop-blur border border-border font-semibold inline-block">
                {item.funnyLabel}
              </div>
              {location && (
                <div className="mt-2 text-sm font-medium text-foreground/90">📍 {location}</div>
              )}
            </div>
            {item.score != null && <ScoreBadge score={item.score} />}
          </div>
          <div className="relative">
            <p className="text-lg sm:text-xl font-semibold leading-snug text-balance line-clamp-4">
              "{item.title}"
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>💬 {fmt(item.commentCount)} · ⚖️ {fmt(item.verdictCount)}</span>
              <span className="text-primary">Read story →</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

/* ───────────────────────── Main CTA ───────────────────────── */

function MainCTA() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-20 text-center">
      <motion.h2
        initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        className="text-4xl sm:text-6xl font-black tracking-tight text-balance"
      >
        {t("cta.headline")}
      </motion.h2>
      <p className="mt-4 text-muted-foreground text-balance max-w-xl mx-auto">{t("cta.sub")}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
        <motion.div
          initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          whileHover={{ y: -4 }}
          className="group rounded-3xl border border-border bg-gradient-to-br from-card to-surface p-6 hover:border-primary/60 transition relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition" />
          <div className="relative">
            <div className="text-xs font-bold tracking-wider text-primary">{t("cta.spill.tag")}</div>
            <div className="mt-2 text-2xl font-bold leading-tight">{t("cta.spill.title")}</div>
            <p className="mt-2 text-sm text-muted-foreground">{t("cta.spill.desc")}</p>
            <Link
              to="/spill"
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm shadow-lg"
            >
              {t("cta.spill.cta")}
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.06 }}
          whileHover={{ y: -4 }}
          className="group rounded-3xl border border-border bg-gradient-to-br from-card to-surface p-6 hover:border-accent/60 transition relative overflow-hidden"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-accent/10 blur-2xl group-hover:bg-accent/20 transition" />
          <div className="relative">
            <div className="text-xs font-bold tracking-wider text-accent">{t("cta.judge.tag")}</div>
            <div className="mt-2 text-2xl font-bold leading-tight">{t("cta.judge.title")}</div>
            <p className="mt-2 text-sm text-muted-foreground">{t("cta.judge.desc")}</p>
            <Link
              to="/scan/start"
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface-elevated border border-border font-semibold text-sm hover:border-accent/60 transition"
            >
              {t("cta.judge.cta")}
            </Link>
          </div>
        </motion.div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">{t("cta.hint")}</p>
    </section>
  );
}

/* ───────────────────────── Trending feed with tabs ───────────────────────── */

type TabKey = "trending" | "latest" | FeedCategory;
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "trending", label: "🔥 Trending" },
  { key: "latest", label: "🆕 Latest" },
  { key: "chaos", label: "💀 Chaos" },
  { key: "wholesome", label: "❤️ Wholesome" },
  { key: "family", label: "👨‍👩‍👧 Family Drama" },
  { key: "situationship", label: "🤡 Situationship" },
  { key: "marriage", label: "💍 Marriage" },
  { key: "plot_twist", label: "🍿 Plot Twist" },
];

function TrendingFeed() {
  const fetchFeed = useServerFn(listTrendingFeed);
  const [tab, setTab] = useState<TabKey>("trending");

  const params = useMemo(() => {
    if (tab === "trending") return { limit: 24, sort: "trending" as const };
    if (tab === "latest") return { limit: 24, sort: "latest" as const };
    return { limit: 24, sort: "trending" as const, category: tab };
  }, [tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["trending-feed", tab],
    queryFn: () => fetchFeed({ data: params }),
    staleTime: 60_000,
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">The Feed</h3>
          <p className="text-sm text-muted-foreground">Real stories, fresh chaos. Updated live.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3">
        {TABS.map((tb) => {
          const active = tb.key === tab;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-elevated border-border hover:border-primary/60"
              }`}
            >
              {tb.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mb-3 break-inside-avoid rounded-2xl border border-border bg-card animate-pulse aspect-[4/3]" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
          {data.map((item, i) => (
            <FeedCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border">
          <p className="text-2xl mb-2">☕</p>
          <p className="font-semibold">No tea here yet</p>
          <p className="text-sm text-muted-foreground mt-1">Try another category — or be the first to spill.</p>
          <Link
            to="/spill"
            className="mt-4 inline-flex px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold"
          >
            ☕ Spill The Tea
          </Link>
        </div>
      )}
    </section>
  );
}

function fmt(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ───────────────────────── Leaderboards ───────────────────────── */

function Leaderboards() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h3 className="text-xl sm:text-2xl font-semibold">{t("boards.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("boards.sub")}</p>
      <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {BOARD_KEYS.map((k, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition cursor-pointer"
          >
            <div className="text-3xl">{t(`boards.items.${k}.emoji` as const)}</div>
            <div className="mt-2 font-semibold">{t(`boards.items.${k}.title` as const)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t(`boards.items.${k}.copy` as const)}</div>
            <div className="mt-4 text-xs text-primary">View board →</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-2xl sm:text-3xl font-bold text-balance">{t("how.title")}</h3>
        <p className="mt-2 text-muted-foreground">{t("how.sub")}</p>
      </div>
      <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {DIM_KEYS.map((k, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="font-semibold">{t(`how.dims.${k}.name` as const)}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t(`how.dims.${k}.copy` as const)}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SocialProof() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h3 className="text-xl sm:text-2xl font-semibold text-center">{t("proof.title")}</h3>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {PROOF_KEYS.map((k, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-gradient-to-br from-card to-surface p-5 text-center"
          >
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t(`proof.items.${k}.n` as const)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{t(`proof.items.${k}.label` as const)}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SoftSignup() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <h3 className="text-3xl font-bold">{t("signup.title")}</h3>
      <p className="mt-2 text-muted-foreground text-balance">{t("signup.sub")}</p>
      <div className="mt-6 space-y-2">
        <Link to="/enter" search={{ redirect: undefined }} className="block w-full px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-95 transition">
          ✉️ {t("signup.email")}
        </Link>
      </div>
    </section>
  );
}

function ScoreBadge({ score, small = false }: { score: number; small?: boolean }) {
  const tier =
    score >= 800 ? "legendary" : score >= 600 ? "high" : score >= 350 ? "mid" : "low";
  const cls =
    tier === "legendary" ? "bg-score-legendary"
      : tier === "high" ? "bg-score-high"
      : tier === "mid" ? "bg-score-mid"
      : "bg-score-low";
  return (
    <div className={`${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} rounded-md font-bold text-background ${cls}`}>
      {score}
    </div>
  );
}

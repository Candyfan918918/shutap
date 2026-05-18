import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { I18nProvider } from "@/lib/i18n/context";
import { useT } from "@/lib/i18n/context";
import { detectBrowserLocale, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: IndexShell,
  head: () => ({
    meta: [
      { title: "Divorce Rank · 婚姻比惨榜 — How tragic is your marriage?" },
      { name: "description", content: "Anonymous global community for marriage and divorce stories. AI scores your story 0–1000. For entertainment only — not legal advice." },
      { property: "og:title", content: "Divorce Rank · 婚姻比惨榜" },
      { property: "og:description", content: "How tragic is your marriage? Find out." },
      { property: "og:type", content: "website" },
    ],
  }),
});

function IndexShell() {
  // Phase 1 minimal: detect locale on client. Locale-prefixed routes ship in Phase 1.5.
  const locale: Locale = typeof window !== "undefined" ? detectBrowserLocale() : "en";
  return (
    <I18nProvider locale={locale}>
      <HomePage />
    </I18nProvider>
  );
}

const SEED_CHAMPIONS = [
  { flag: "🇺🇸", country: "USA", rank: 1, score: 982, preview: "He secretly had another family for 8 years.", tags: ["cheating", "custody"] },
  { flag: "🇨🇳", country: "China", rank: 1, score: 963, preview: "离婚后我才发现房子不在我名下。", tags: ["money", "in_laws"] },
  { flag: "🇪🇸", country: "Spain", rank: 1, score: 941, preview: "Descubrí los mensajes el día de nuestro aniversario.", tags: ["cheating"] },
  { flag: "🇧🇷", country: "Brazil", rank: 1, score: 928, preview: "Ele desapareceu com toda a poupança da família.", tags: ["money"] },
  { flag: "🇯🇵", country: "Japan", rank: 1, score: 917, preview: "義母が毎週うちの鍵を勝手に使っていた。", tags: ["in_laws"] },
  { flag: "🇰🇷", country: "Korea", rank: 1, score: 905, preview: "결혼 5년 만에 그가 빚 3억을 숨겨왔다는 걸 알았다.", tags: ["money", "toxic"] },
];

const CATEGORY_KEYS = ["cheating", "custody", "money", "toxic", "in_laws", "neglect", "recovery"] as const;

function HomePage() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary ring-danger" />
            <span className="font-semibold tracking-tight">{t("appName")}</span>
          </div>
          <nav className="text-sm text-muted-foreground flex gap-5">
            <a className="hover:text-foreground transition" href="#feed">{t("nav.feed")}</a>
            <a className="hover:text-foreground transition" href="#rankings">{t("nav.rankings")}</a>
            <a className="hover:text-foreground transition" href="#submit">{t("nav.submit")}</a>
          </nav>
        </div>
      </header>

      {/* Section 1: Champion wall */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold tracking-tight text-balance"
        >
          {t("home.championWallTitle")}
        </motion.h1>
        <p className="mt-2 text-muted-foreground">{t("home.championWallSubtitle")}</p>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {SEED_CHAMPIONS.map((c, i) => (
            <motion.article
              key={c.country}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative rounded-xl bg-card border border-border p-5 overflow-hidden hover:border-primary/50 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-2xl leading-none">{c.flag}</span>
                  <span className="font-medium text-foreground">{c.country}</span>
                  <span className="text-primary font-semibold">{t("home.rank")}{c.rank}</span>
                </div>
                <ScoreBadge score={c.score} />
              </div>
              <p className="mt-4 text-lg leading-snug text-balance">"{c.preview}"</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                    #{t(`categories.${tag}` as never)}
                  </span>
                ))}
              </div>
              <button className="mt-5 text-sm text-primary hover:text-primary-glow transition">
                {t("home.readStory")} →
              </button>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Section 2: CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance"
        >
          {t("home.ctaHeadline")}
        </motion.h2>
        <p className="mt-4 text-muted-foreground">{t("home.ctaSub")}</p>
        <button
          id="submit"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium ring-danger hover:scale-[1.02] transition"
        >
          {t("home.ctaButton")} →
        </button>
      </section>

      {/* Section 3: Categories */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h3 className="text-xl font-semibold mb-4">{t("home.categoriesTitle")}</h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((k) => (
            <span key={k} className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm hover:border-primary/50 cursor-pointer transition">
              #{t(`categories.${k}` as never)}
            </span>
          ))}
        </div>
      </section>

      {/* Section 4: Trending placeholder */}
      <section id="feed" className="mx-auto max-w-6xl px-4 py-10">
        <h3 className="text-xl font-semibold mb-4">{t("home.trendingTitle")}</h3>
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Live feed coming in Phase 2 — story composer + AI scoring.
        </div>
      </section>

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted-foreground text-center">
          ⚠️ {t("disclaimer")}
        </div>
      </footer>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 700 ? "legendary" : score >= 400 ? "high" : score >= 200 ? "mid" : "low";
  const cls =
    tier === "legendary" ? "bg-score-legendary"
    : tier === "high" ? "bg-score-high"
    : tier === "mid" ? "bg-score-mid"
    : "bg-score-low";
  return (
    <div className={`px-2.5 py-1 rounded-md text-xs font-bold text-background ${cls}`}>
      {score}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { I18nProvider, useT } from "@/lib/i18n/context";
import {
  detectBrowserLocale,
  isLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { IdentityHeaderSlot } from "@/components/identity/IdentityHeaderSlot";

export const Route = createFileRoute("/")({
  component: IndexShell,
  head: () => ({
    meta: [
      { title: "Marriage Drama · 婚姻真相局 — The truth about marriage" },
      {
        name: "description",
        content:
          "Love. Chaos. Plot twists. A funny, warm, anonymous-ish global community sharing the truth of marriage. Get your Drama Score.",
      },
      { property: "og:title", content: "Marriage Drama · 婚姻真相局" },
      { property: "og:description", content: "How dramatic is your marriage? Be honest." },
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
    try { window.localStorage.setItem(LOCALE_KEY, l); } catch {}
  };
  return (
    <I18nProvider locale={locale}>
      <HomePage locale={locale} onLocaleChange={change} />
    </I18nProvider>
  );
}

/* ───────────────────────── Placeholder data ───────────────────────── */

type Champion = {
  flag: string; country: string; scope: "global" | "country" | "city" | "trending";
  score: number; preview: string; tag: string;
};
const CHAMPIONS: Champion[] = [
  { flag: "🌍", country: "Global #1", scope: "global", score: 994, preview: "He said it was overtime. Turns out it was a second family.", tag: "Cheating" },
  { flag: "🇺🇸", country: "USA #1", scope: "country", score: 982, preview: "I found her wedding ring… on someone else's hand at brunch.", tag: "Plot Twist" },
  { flag: "🇨🇳", country: "中国 #1", scope: "country", score: 963, preview: "离婚后我才发现房子不在我名下。", tag: "财产大战" },
  { flag: "🇯🇵", country: "日本 #1", scope: "country", score: 921, preview: "结婚20年，他退休当天提离婚。", tag: "Cold Marriage" },
  { flag: "🇪🇸", country: "España #1", scope: "country", score: 909, preview: "Descubrí los mensajes el día de nuestro aniversario.", tag: "Cheating" },
  { flag: "🇧🇷", country: "Brasil #1", scope: "country", score: 898, preview: "Ele sumiu com a poupança e a cachorra.", tag: "Financial Shock" },
  { flag: "🇰🇷", country: "한국 #1", scope: "country", score: 887, preview: "결혼 5년 만에 그가 빚 3억을 숨겨왔다.", tag: "Hidden Debt" },
  { flag: "🏙️", country: "Shanghai #1", scope: "city", score: 871, preview: "婆婆有我家钥匙的备份。她每天都来。", tag: "👵 MIL" },
  { flag: "🔥", country: "Trending Now", scope: "trending", score: 845, preview: "We renewed our vows last week. He filed yesterday.", tag: "Plot Twist" },
  { flag: "🔥", country: "Trending Now", scope: "trending", score: 812, preview: "他求婚那天，我前任发来一张我们的合照。", tag: "💀 Chaos" },
];

type FeedCard = {
  id: number; nickname: string; preview: string; score: number; tag: string;
  likes: number; comments: number; saves: number; tall?: boolean; img?: string;
};
const FEED: FeedCard[] = [
  { id: 1, nickname: "爱吃火锅的小猫", preview: "婆婆把我们的婚纱照换成了她和老公的合照。客厅。正中央。", score: 781, tag: "👵 MIL", likes: 12400, comments: 893, saves: 2100, tall: true },
  { id: 2, nickname: "Silent Mango", preview: "He proposed in Paris. He cheated in Bali. We honeymooned in Tokyo. I left in Seoul.", score: 902, tag: "💔 Cheating", likes: 24100, comments: 1822, saves: 5600 },
  { id: 3, nickname: "周一不上班", preview: "结婚十年第一次他主动洗碗。我以为他要离婚。结果他升职了。", score: 312, tag: "❤️ Sweet-ish", likes: 8800, comments: 401, saves: 1100 },
  { id: 4, nickname: "Lost Pancake", preview: "Our couples therapist quit. On us. Mid-session.", score: 689, tag: "🤡 Plot Twist", likes: 15300, comments: 990, saves: 3400, tall: true },
  { id: 5, nickname: "南瓜灯灯灯", preview: "他给我买了 LV。结果是奥莱的。结果是假的。结果是从同事那里借的。", score: 754, tag: "💸 Debt", likes: 11200, comments: 712, saves: 1800 },
  { id: 6, nickname: "Tired Tofu", preview: "12 years. One real apology. Worth every minute. I'm not saying he's perfect. I'm saying he tried.", score: 188, tag: "🥹 Healing", likes: 30100, comments: 2400, saves: 8200, tall: true },
  { id: 7, nickname: "海边的椰子", preview: "婚礼当天，他妈妈穿了白色。整套。带头纱。", score: 612, tag: "👵 MIL", likes: 9800, comments: 540, saves: 1400 },
  { id: 8, nickname: "Quiet Whale", preview: "We argued for 3 hours about a parking spot. Same parking spot. Empty parking lot.", score: 422, tag: "😶 Daily", likes: 6700, comments: 311, saves: 800 },
];

const CAT_KEYS = ["cheating", "debt", "mil", "neglect", "divorce", "custody", "romance", "healing"] as const;
const BOARD_KEYS = ["chaotic", "sweet", "twist", "money", "mil", "recovery"] as const;
const DIM_KEYS = ["twist", "damage", "money", "family", "comms", "love"] as const;
const PROOF_KEYS = ["stories", "countries", "points", "survived"] as const;

/* ───────────────────────── Page ───────────────────────── */

function HomePage({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (l: Locale) => void }) {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      <TopBar locale={locale} onChange={onLocaleChange} />
      <main className="pb-24">
        <ChampionWall />
        <MainCTA />
        <Categories />
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

/* ───────────────────────── Top bar ───────────────────────── */

function TopBar({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/75 border-b border-border">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-sm">
            💔
          </div>
          <span className="font-semibold tracking-tight">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
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

/* ───────────────────────── 1. Champion wall ───────────────────────── */

function ChampionWall() {
  const { t } = useT();
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
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
          {(["global", "country", "city", "trending"] as const).map((k) => (
            <span key={k} className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border">
              {t(`wall.chips.${k}` as const)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 px-4 sm:px-[max(1rem,calc(50vw-36rem))] snap-x snap-mandatory">
          {CHAMPIONS.map((c, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="snap-start shrink-0 w-[78vw] sm:w-[320px] rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-card to-surface relative group"
            >
              <div className="aspect-[4/5] p-5 flex flex-col justify-between relative">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_10%,oklch(0.62_0.22_25/_0.5),transparent_60%)]" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-4xl">{c.flag}</div>
                    <div className="mt-2 text-sm font-medium text-foreground/90">{c.country}</div>
                  </div>
                  <ScoreBadge score={c.score} />
                </div>
                <div className="relative">
                  <p className="text-lg sm:text-xl font-semibold leading-snug text-balance">
                    "{c.preview}"
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs px-2 py-1 rounded-full bg-background/50 backdrop-blur border border-border">
                      #{c.tag}
                    </span>
                    <span className="text-xs text-primary group-hover:text-primary-glow transition">
                      {t("wall.readStory")} →
                    </span>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 2. Main CTA ───────────────────────── */

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
        {/* Spill The Tea */}
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
              to="/compose"
              search={{ score: 0 }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm shadow-lg"
            >
              {t("cta.spill.cta")}
            </Link>
          </div>
        </motion.div>

        {/* Judge My Relationship */}
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
              to="/scan"
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

/* ───────────────────────── 3. Categories ───────────────────────── */

function Categories() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h3 className="text-xl sm:text-2xl font-semibold mb-4">{t("cats.title")}</h3>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {CAT_KEYS.map((k) => (
          <button
            key={k}
            className="shrink-0 px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm hover:border-primary/60 hover:bg-card transition"
          >
            {t(`cats.items.${k}` as const)}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── 4. Trending feed ───────────────────────── */

function TrendingFeed() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">{t("feed.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("feed.sub")}</p>
        </div>
      </div>
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
        {FEED.map((card, i) => (
          <FeedCardView key={card.id} card={card} index={i} />
        ))}
      </div>
      <div className="mt-8 text-center">
        <button className="px-5 py-2.5 rounded-full bg-surface-elevated border border-border text-sm hover:border-primary/50 transition">
          {t("feed.loadMore")}
        </button>
      </div>
    </section>
  );
}

function FeedCardView({ card, index }: { card: FeedCard; index: number }) {
  const { t } = useT();
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className="mb-3 break-inside-avoid rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/40 transition group"
    >
      <div className={`relative ${card.tall ? "aspect-[3/4]" : "aspect-[4/3]"} bg-gradient-to-br from-surface-elevated via-surface to-card flex items-center justify-center p-4`}>
        <div className="absolute top-2 right-2"><ScoreBadge score={card.score} small /></div>
        <p className="text-base sm:text-lg font-medium leading-snug text-balance text-center">
          "{card.preview}"
        </p>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent shrink-0" />
            <span className="text-xs truncate text-muted-foreground">{card.nickname}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-elevated border border-border shrink-0">
            {card.tag}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>💀 {fmt(card.likes)}</span>
          <span>😭 {fmt(card.comments)}</span>
          <span>🚩 {fmt(card.saves)}</span>
          <span>☠️</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button className="flex-1 text-[11px] px-2 py-1 rounded-full bg-surface-elevated hover:bg-secondary transition">{t("feed.been")}</button>
          <button className="flex-1 text-[11px] px-2 py-1 rounded-full bg-surface-elevated hover:bg-secondary transition">{t("feed.worse")}</button>
        </div>
      </div>
    </motion.article>
  );
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ───────────────────────── 5. Leaderboards ───────────────────────── */

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

/* ───────────────────────── 6. How it works ───────────────────────── */

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

/* ───────────────────────── 7. Social proof ───────────────────────── */

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

/* ───────────────────────── 8. Soft signup ───────────────────────── */

function SoftSignup() {
  const { t } = useT();
  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <h3 className="text-3xl font-bold">{t("signup.title")}</h3>
      <p className="mt-2 text-muted-foreground text-balance">{t("signup.sub")}</p>
      <div className="mt-6 space-y-2">
        <button className="w-full px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-95 transition">
          ✉️ {t("signup.email")}
        </button>
        <button className="w-full px-5 py-3 rounded-full bg-surface-elevated border border-border font-medium hover:border-primary/50 transition">
          {t("signup.google")}
        </button>
        <button className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground transition">
          {t("signup.skip")}
        </button>
      </div>
    </section>
  );
}

/* ───────────────────────── Bits ───────────────────────── */

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

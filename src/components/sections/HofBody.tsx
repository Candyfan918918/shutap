// Hall of Fame body — shared between /hof route and / (landing) embed.
// Excludes the page-level sticky header and column wrapper.
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTrendingFeed, type FeedItem } from "@/lib/posts/feed.functions";

type Period = "today" | "week" | "month" | "all";

export function HofBody() {
  const [period, setPeriod] = useState<Period>("week");
  const fetchFeed = useServerFn(listTrendingFeed);
  const q = useQuery({
    queryKey: ["hof", "feed"],
    queryFn: () =>
      (fetchFeed as unknown as (a: {
        data: { sort: "trending"; limit: 12 };
      }) => Promise<FeedItem[]>)({ data: { sort: "trending", limit: 12 } }),
    staleTime: 60_000,
  });

  const items = q.data ?? [];
  const shockingCourt = items[0] ?? null;
  const mostRelatable = items[1] ?? items[0] ?? null;
  const mostDramatic = items[2] ?? items[0] ?? null;
  const mostSurprising = items[3] ?? items[1] ?? null;
  const mostRelatableCat = items[4] ?? items[1] ?? null;
  const mostShared = items[5] ?? items[2] ?? null;

  const totalVerdicts = items.reduce((s, p) => s + (p.verdictCount ?? 0), 0);
  const totalRelate = items.reduce((s, p) => s + (p.likeCount ?? 0), 0);
  const cases = items.length;

  return (
    <>
      {/* HERO */}
      <section className="hero-dark hof-hero">
        <div
          className="hero-dark__orb hero-dark__orb--tr"
          style={{ background: "var(--c-gold)", opacity: 0.1 }}
        />
        <div className="hero-dark__orb hero-dark__orb--bl" />
        <div className="hof-hero__crown">👑</div>
        <div className="hof-hero__tag">The platform's greatest moments</div>
        <h1 className="hof-hero__title">Hall of Fame</h1>
        <p className="hof-hero__sub">
          Court verdicts that shook the platform. Stories that resonated with
          thousands. The judges who got it right.
        </p>
        <div className="hof-hero__stats">
          <StatTile n={fmt(totalVerdicts || 4_800_000)} l="total verdicts" />
          <StatTile n={fmt(totalRelate || 312_000)} l="relate taps" />
          <StatTile n={fmt(cases || 18_401)} l="cases heard" last />
        </div>
      </section>

      {/* PERIOD SWITCHER */}
      <div className="flex gap-1.5 px-3.5 py-2.5 border-b border-c-surface-3">
        {(["today", "week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`hof-period ${period === p ? "hof-period--on" : ""}`}
          >
            {p === "today"
              ? "Today"
              : p === "week"
                ? "This week"
                : p === "month"
                  ? "This month"
                  : "All time"}
          </button>
        ))}
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-2.5 px-3.5 pt-2.5 pb-1">
        <Leg color="var(--c-gold)" label="Court verdict result" />
        <Leg color="var(--c-teal)" label="Stream story resonance" />
        <Leg color="var(--c-purple)" label="Top juror" />
      </div>

      {/* MOST SHOCKING COURT VERDICT */}
      <Divider icon="⚖️" tint="var(--c-gold)" label="Most shocking verdict" />
      {shockingCourt ? (
        <CourtVerdictCard
          item={shockingCourt}
          flagIcon="⚖️"
          flagText="Court verdict · World Court"
          rank="#1 this week"
          tier="🌐 World Court · 72h"
          benchLabel="The Bench declared"
          benchQuote="The court has seen betrayal. It has seen deception. It has not often seen both at this scale. The verdict is unanimous."
          split="94% Red flag · 4% Run · 2% Lawyer up"
          bars={[
            { w: 94, c: "#f09595" },
            { w: 4, c: "var(--c-pink-soft)" },
            { w: 2, c: "var(--c-amber-soft)" },
          ]}
          outcome="Outcome confirmed · 30 days · She filed for divorce. The court was right."
        />
      ) : (
        <EmptyTile />
      )}

      {/* MOST RELATABLE STREAM STORY */}
      <Divider icon="💚" tint="var(--c-teal)" label="Most relatable story" />
      {mostRelatable ? (
        <StreamResonanceCard
          item={mostRelatable}
          flagIcon="💚"
          flagText="Stream story · Relate resonance"
          rank="#1 this week"
          tier="↗ Never reached court"
          relateStat={`${fmt(mostRelatable.likeCount || 9841)} relate taps`}
          relateSub={`${fmt(mostRelatable.likeCount || 9841)} people said "it happened to me too" — the highest relate count this week. No court verdict. Just recognition.`}
        />
      ) : (
        <EmptyTile />
      )}

      {/* TOP JUROR */}
      <Divider icon="👑" tint="var(--c-purple)" label="Top juror this week" />
      <TopJurorCard />

      {/* HOW THE HOF WORKS */}
      <Divider icon="ℹ" tint="var(--c-text-3)" label="How the HOF works" />
      <Distinction />

      {/* COURT HOF — BY CATEGORY */}
      <Divider icon="⚖️" tint="var(--c-gold)" label="Court HOF · By category" />
      {mostDramatic && (
        <CourtVerdictCard
          item={mostDramatic}
          flagIcon="🔥"
          flagText="Most dramatic · Work court"
          rank="#1"
          tier="🏢 National Court · 48h"
          benchLabel="Final verdict"
          benchQuote="The court finds the company guilty of institutional failure. The individual is not on trial — the system is."
          split="71% Red flag · 22% Lawyer up · 7% Other"
          bars={[
            { w: 71, c: "#f09595" },
            { w: 22, c: "var(--c-amber-soft)" },
            { w: 7, c: "var(--c-surface-3)" },
          ]}
        />
      )}
      {mostSurprising && (
        <CourtVerdictCard
          item={mostSurprising}
          flagIcon="🎉"
          flagText="Most surprising outcome · Family"
          rank="#1"
          tier="🌍 Regional Court · 24h"
          benchLabel="Court said · 78% predicted"
          benchQuote="Cut contact. The pattern suggests this is not genuine."
          split="78% said walk away — she reconciled instead"
          bars={[
            { w: 78, c: "#f09595" },
            { w: 14, c: "var(--c-teal-soft)" },
            { w: 8, c: "var(--c-surface-3)" },
          ]}
          outcome="Outcome: She reconciled. 2 years on, still in contact. Court was wrong — and she was right."
          footer={
            <div className="mt-2 text-[11px] text-c-purple-deep flex items-center gap-1.5">
              <span>🧠</span> Prediction score impact: 78% of predictors lost
              points. 22% who said reconcile gained.
            </div>
          }
        />
      )}

      {/* STREAM HOF — BY RESONANCE */}
      <Divider icon="💚" tint="var(--c-teal)" label="Stream HOF · By resonance" />
      {mostRelatableCat && (
        <StreamResonanceCard
          item={mostRelatableCat}
          flagIcon="👥"
          flagText="Most relatable · Stream only"
          rank="#1"
          tier="Stream only · No court nomination"
          tierMuted
          relateStat={`${fmt(mostRelatableCat.likeCount || 9841)} "it happened to me too"`}
          relateSub="Never needed a court verdict to matter to thousands."
        />
      )}
      {mostShared && (
        <StreamResonanceCard
          item={mostShared}
          flagIcon="↗"
          flagText="Most shared · Cross-platform"
          rank="#1"
          tier="🐦 Went viral on X"
          relateStat="148,000 external views"
          relateSub="Shared to X, TikTok, and WhatsApp. Brought 4,200 new users to the platform in 48 hours."
        />
      )}
    </>
  );
}

function StatTile({ n, l, last }: { n: string; l: string; last?: boolean }) {
  return (
    <div className={`px-2.5 py-2 text-center ${last ? "" : "border-r border-white/10"}`}>
      <div className="text-[16px] font-medium text-white">{n}</div>
      <div className="text-[10px] text-c-ink-3 mt-0.5">{l}</div>
    </div>
  );
}

function Leg({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-c-text-3">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Divider({ icon, tint, label }: { icon: string; tint: string; label: string }) {
  return (
    <div className="px-3.5 pt-3.5 pb-1.5 flex items-center gap-2">
      <span className="flex-1 h-px bg-c-surface-3" />
      <span className="text-[11px] font-medium text-c-text-3 whitespace-nowrap flex items-center gap-1">
        <span style={{ color: tint }}>{icon}</span> {label}
      </span>
      <span className="flex-1 h-px bg-c-surface-3" />
    </div>
  );
}

function EmptyTile() {
  return (
    <div className="mx-3 mb-2.5 rounded-2xl border border-dashed border-c-border bg-c-surface-2 p-6 text-center">
      <p className="text-xs text-c-text-2">Nothing's risen here yet. Keep judging.</p>
    </div>
  );
}

type Bar = { w: number; c: string };

function CourtVerdictCard(props: {
  item: FeedItem;
  flagIcon: string;
  flagText: string;
  rank: string;
  tier: string;
  benchLabel: string;
  benchQuote: string;
  split: string;
  bars: Bar[];
  outcome?: string;
  footer?: React.ReactNode;
}) {
  const { item } = props;
  const cat = catFor(item.scoreCategory);
  const closing = extractClosingQ(item.storyText);
  return (
    <Link to="/post/$postId" params={{ postId: item.id }} className="block court-card mx-3 mb-2.5">
      <div className="court-card__flag">
        <div className="flex items-center gap-1.5 text-c-gold-deep">
          <span>{props.flagIcon}</span>
          <span className="text-[10px] font-medium tracking-[0.07em] uppercase">{props.flagText}</span>
        </div>
        <div className="court-card__rank">{props.rank}</div>
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
          <span className="text-[10px] text-c-text-3 ml-auto flex items-center gap-1">{props.tier}</span>
        </div>
        <div className="text-[13px] font-medium leading-snug mb-1">{item.title || item.storyText.slice(0, 100)}</div>
        {closing && (
          <div className="text-[11px] italic text-c-text-3 mb-2 leading-snug">"{closing}"</div>
        )}
        <div className="rounded-xl bg-c-gold-soft border border-c-gold-border p-2.5 mt-1 mb-2">
          <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-c-gold-deep mb-1">{props.benchLabel}</div>
          <div className="text-[12px] italic text-c-amber-deep leading-snug">"{props.benchQuote}"</div>
          <div className="text-[11px] font-medium text-c-gold-deep mt-1">{props.split}</div>
        </div>
        <div className="cc-bar h-[7px] rounded flex overflow-hidden bg-c-surface-3 mb-1.5">
          {props.bars.map((b, i) => (
            <div key={i} style={{ width: `${b.w}%`, background: b.c }} />
          ))}
        </div>
        <div className="flex gap-2 flex-wrap mt-1 text-[10px] text-c-text-3">
          <span>👥 {fmt(item.verdictCount)} verdicts</span>
          <span>⏱ Verdict locked</span>
          <span className="text-c-teal">✓ Both sides heard</span>
        </div>
        {props.outcome && (
          <div className="mt-2 rounded-xl bg-c-teal-soft border border-c-teal-border px-2.5 py-2 text-[11px] text-c-teal-deep leading-snug flex items-start gap-1.5">
            <span>📅</span><span>{props.outcome}</span>
          </div>
        )}
        {props.footer}
      </div>
    </Link>
  );
}

function StreamResonanceCard(props: {
  item: FeedItem;
  flagIcon: string;
  flagText: string;
  rank: string;
  tier: string;
  tierMuted?: boolean;
  relateStat: string;
  relateSub: string;
}) {
  const { item } = props;
  const cat = catFor(item.scoreCategory);
  const closing = extractClosingQ(item.storyText);
  return (
    <Link to="/post/$postId" params={{ postId: item.id }} className="block stream-card mx-3 mb-2.5">
      <div className="stream-card__flag">
        <div className="flex items-center gap-1.5 text-c-teal-deep">
          <span>{props.flagIcon}</span>
          <span className="text-[10px] font-medium tracking-[0.07em] uppercase">{props.flagText}</span>
        </div>
        <div className="stream-card__rank">{props.rank}</div>
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
          <span className={`text-[10px] ml-auto ${props.tierMuted ? "text-c-text-3" : "text-c-teal"}`}>{props.tier}</span>
        </div>
        <div className="text-[13px] font-medium leading-snug mb-1">{item.title || item.storyText.slice(0, 100)}</div>
        {closing && (
          <div className="text-[11px] italic text-c-text-3 mb-2 leading-snug">"{closing}"</div>
        )}
        <div className="rounded-xl bg-c-teal-soft border border-c-teal-border p-2.5 mt-1 mb-2">
          <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-c-teal-deep mb-0.5">Why it's here</div>
          <div className="text-[13px] font-medium text-c-teal">{props.relateStat}</div>
          <div className="text-[11px] text-c-teal-deep leading-snug">{props.relateSub}</div>
        </div>
        <div className="h-[7px] rounded flex overflow-hidden bg-c-surface-3 mb-1.5">
          <div style={{ width: "44%", background: "#f09595" }} />
          <div style={{ width: "30%", background: "var(--c-purple-soft)" }} />
          <div style={{ width: "18%", background: "var(--c-teal-soft)" }} />
          <div style={{ width: "8%",  background: "var(--c-surface-3)" }} />
        </div>
        <div className="flex gap-2 flex-wrap mt-1 text-[10px] text-c-text-3">
          <span>💬 {fmt(item.commentCount)} comments</span>
          <span>👥 {fmt(item.verdictCount)} verdicts</span>
          <span>Stream only</span>
        </div>
      </div>
    </Link>
  );
}

function TopJurorCard() {
  return (
    <div className="user-card mx-3 mb-3">
      <div className="user-card__flag">
        <div className="text-[10px] font-medium tracking-[0.07em] uppercase text-c-purple-deep flex items-center gap-1">
          <span>👑</span> Legend of the court
        </div>
        <div className="user-card__rank">#1 juror · This week</div>
      </div>
      <div className="p-3.5 flex gap-3 items-start">
        <div className="w-11 h-11 rounded-full bg-c-purple-soft border-[1.5px] border-c-purple-border flex items-center justify-center text-[22px] flex-shrink-0">
          🦉
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium">Wistful Lagos Owl</div>
          <div className="text-[11px] text-c-purple-deep mb-2">👑 Legend of the Court · 14 months active</div>
          <div className="grid grid-cols-2 gap-1.5">
            <Score n="94%" l="Justice score" color="var(--c-gold)" />
            <Score n="98%" l="Wisdom score" color="var(--c-teal)" />
            <Score n="87%" l="Empathy score" color="var(--c-pink)" />
            <Score n="91%" l="Prediction score" color="var(--c-purple)" />
          </div>
        </div>
      </div>
      <div className="px-3.5 pt-2 pb-3 flex flex-wrap gap-1.5 border-t border-c-surface-3">
        <Badge bg="var(--c-gold-soft)"   fg="var(--c-gold-deep)"   bd="var(--c-gold-border)">3× Most Accurate</Badge>
        <Badge bg="var(--c-teal-soft)"   fg="var(--c-teal-deep)"   bd="var(--c-teal-border)">Top Wisdom</Badge>
        <Badge bg="var(--c-purple-soft)" fg="var(--c-purple-deep)" bd="var(--c-purple-border)">World Court Juror</Badge>
      </div>
    </div>
  );
}

function Score({ n, l, color }: { n: string; l: string; color: string }) {
  return (
    <div className="rounded-lg bg-c-surface-2 px-2 py-1.5">
      <div className="text-[13px] font-medium" style={{ color }}>{n}</div>
      <div className="text-[10px] text-c-text-3">{l}</div>
    </div>
  );
}

function Badge({ children, bg, fg, bd }: { children: React.ReactNode; bg: string; fg: string; bd: string }) {
  return (
    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border" style={{ background: bg, color: fg, borderColor: bd }}>
      {children}
    </span>
  );
}

function Distinction() {
  return (
    <div className="mx-3 mb-3 rounded-2xl overflow-hidden border border-c-surface-3 bg-c-surface">
      <div className="bg-c-ink text-white px-3.5 py-2.5 text-[12px] font-medium">Two ways to make the Hall of Fame</div>
      <div className="grid grid-cols-2 divide-x divide-c-surface-3">
        <DistCol
          tintBg="var(--c-gold-soft)" tintFg="var(--c-gold-deep)" dot="var(--c-gold)"
          icon="⚖️" name="Court verdict"
          points={[
            "Story nominated to Court by the algorithm",
            "Verdict locked at tier deadline",
            "The Bench declares a formal result",
            "Scored on: controversy + scale + outcome match",
          ]}
        />
        <DistCol
          tintBg="var(--c-teal-soft)" tintFg="var(--c-teal-deep)" dot="var(--c-teal)"
          icon="💚" name="Stream resonance"
          points={[
            "Story lives in the feed — never reached court",
            "Community related in massive numbers",
            "No formal verdict — just raw recognition",
            "Scored on: relate count + comment depth + shares",
          ]}
        />
      </div>
      <div className="px-3 py-2.5 bg-c-surface-2 text-[11px] text-c-text-3 leading-relaxed">
        A story can win HOF without ever going to Court. The relate tap is its own form of verdict — personal, not structural. The platform honours both.
      </div>
    </div>
  );
}

function DistCol(props: { tintBg: string; tintFg: string; dot: string; icon: string; name: string; points: string[] }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-[18px] h-[18px] rounded-md inline-flex items-center justify-center text-[12px]" style={{ background: props.tintBg }}>{props.icon}</span>
        <span className="text-[11px] font-medium" style={{ color: props.tintFg }}>{props.name}</span>
      </div>
      {props.points.map((p, i) => (
        <div key={i} className="flex gap-1.5 text-[11px] text-c-text-3 leading-relaxed mb-1">
          <span className="w-1 h-1 rounded-full mt-[6px] flex-shrink-0" style={{ background: props.dot }} />
          <span>{p}</span>
        </div>
      ))}
    </div>
  );
}

function extractClosingQ(text: string): string | null {
  if (!text) return null;
  const m = text.match(/([^.?!]*\?)\s*$/);
  if (m) {
    const q = m[1].trim();
    if (q.length > 10 && q.length < 140) return q;
  }
  return null;
}

function catFor(scoreCategory: string | null) {
  const c = (scoreCategory ?? "").toLowerCase();
  if (c.includes("famil") || c.includes("mother") || c.includes("mil")) return { label: "Family", cls: "cat-pill--family" };
  if (c.includes("work") || c.includes("money")) return { label: "Work", cls: "cat-pill--work" };
  if (c.includes("stranger") || c.includes("neigh")) return { label: "Stranger", cls: "cat-pill--stranger" };
  if (c.includes("digital") || c.includes("online")) return { label: "Digital", cls: "cat-pill--digital" };
  return { label: "Romance", cls: "cat-pill--romance" };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

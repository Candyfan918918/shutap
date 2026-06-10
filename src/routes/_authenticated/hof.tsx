// Hall of Fame — the platform's greatest moments.
// Visual reference: shutap_hall_of_fame.html
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTrendingFeed, type FeedItem } from "@/lib/posts/feed.functions";

type Period = "today" | "week" | "month" | "all";

const feedQO = queryOptions({
  queryKey: ["hof", "feed"],
  queryFn: async () => {
    const fn = listTrendingFeed as unknown as (
      args?: { data?: { sort?: "trending"; limit?: number } },
    ) => Promise<FeedItem[]>;
    return fn({ data: { sort: "trending", limit: 12 } });
  },
  staleTime: 60_000,
});

export const Route = createFileRoute("/_authenticated/hof")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(feedQO);
  },
  component: HofPage,
  head: () => ({
    meta: [
      { title: "Hall of Fame — Shutap" },
      { name: "description", content: "Court verdicts that shook the platform. Stories that resonated with thousands. The judges who got it right." },
      { property: "og:title", content: "Hall of Fame — Shutap" },
      { property: "og:description", content: "The platform's greatest moments." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm text-c-text-2">The Hall is dark tonight.</p>
      <p className="text-xs text-c-text-3 break-words">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm">Re-light</button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-c-text-2 text-sm">Nothing on the docket.</div>
  ),
});

function HofPage() {
  const [period, setPeriod] = useState<Period>("week");
  const fetchFeed = useServerFn(listTrendingFeed);
  const q = useSuspenseQuery({
    ...feedQO,
    queryFn: () => (fetchFeed as unknown as (a: { data: { sort: "trending"; limit: 12 } }) => Promise<FeedItem[]>)({
      data: { sort: "trending", limit: 12 },
    }),
  });

  const items = q.data;
  const shockingCourt = items[0] ?? null;
  const mostRelatable = items[1] ?? items[0] ?? null;
  const totalVerdicts = items.reduce((s, p) => s + (p.verdictCount ?? 0), 0);
  const totalRelate = items.reduce((s, p) => s + (p.likeCount ?? 0), 0);
  const cases = items.length;

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">←</Link>
          <div className="flex-1 text-center text-sm font-medium">Hall of Fame</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl">
        {/* HERO */}
        <section className="hero-dark">
          <div className="hero-dark__orb hero-dark__orb--tr" style={{ background: "var(--c-gold)", opacity: 0.10 }} />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="text-[28px] mb-1.5">👑</div>
          <div className="text-[10px] font-medium tracking-[0.10em] uppercase text-c-gold mb-1">
            The platform's greatest moments
          </div>
          <h1 className="text-[20px] font-medium text-white leading-tight mb-1">Hall of Fame</h1>
          <p className="text-[12px] text-c-ink-3 leading-snug">
            Court verdicts that shook the platform. Stories that resonated with thousands. The judges who got it right.
          </p>
          <div className="mt-3 grid grid-cols-3 border border-white/10 rounded-xl overflow-hidden">
            <StatTile n={fmt(totalVerdicts)} l="total verdicts" />
            <StatTile n={fmt(totalRelate)} l="relate taps" />
            <StatTile n={fmt(cases)} l="cases heard" last />
          </div>
        </section>

        {/* PERIOD SWITCHER */}
        <div className="flex gap-1.5 px-3.5 py-2.5 border-b border-c-surface-3">
          {(["today","week","month","all"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`hof-period ${period === p ? "hof-period--on" : ""}`}
            >
              {p === "today" ? "Today" : p === "week" ? "This week" : p === "month" ? "This month" : "All time"}
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
        {shockingCourt ? <CourtVerdictCard item={shockingCourt} /> : <EmptyTile />}

        {/* MOST RELATABLE STREAM STORY */}
        <Divider icon="💚" tint="var(--c-teal)" label="Most relatable story" />
        {mostRelatable ? <StreamResonanceCard item={mostRelatable} /> : <EmptyTile />}

        {/* TOP JUROR */}
        <Divider icon="👑" tint="var(--c-purple)" label="Top juror this week" />
        <TopJurorCard />
      </main>
    </div>
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

function CourtVerdictCard({ item }: { item: FeedItem }) {
  const cat = catFor(item.scoreCategory);
  return (
    <Link to="/post/$postId" params={{ postId: item.id }} className="block court-card mx-3 mb-2.5">
      <div className="court-card__flag">
        <div className="flex items-center gap-1.5 text-c-gold-deep">
          <span>⚖️</span>
          <span className="text-[10px] font-medium tracking-[0.07em] uppercase">Court verdict · World Court</span>
        </div>
        <div className="court-card__rank">#1 this week</div>
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
          <span className="text-[10px] text-c-text-3 ml-auto">🌐 World · 72h</span>
        </div>
        <div className="text-[13px] font-medium leading-snug mb-1">{item.title || item.storyText.slice(0, 100)}</div>
        <div className="rounded-xl bg-c-gold-soft border border-c-gold-border p-2.5 mt-2">
          <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-c-gold-deep mb-1">The Bench declared</div>
          <div className="text-[12px] italic text-c-amber-deep leading-snug">
            The court has seen this case. The verdict is in. The record stands.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-2 text-[10px] text-c-text-3">
          <span>👥 {fmt(item.verdictCount)} verdicts</span>
          <span>⏱ Verdict locked</span>
          <span className="text-c-teal">✓ Both sides heard</span>
        </div>
      </div>
    </Link>
  );
}

function StreamResonanceCard({ item }: { item: FeedItem }) {
  const cat = catFor(item.scoreCategory);
  return (
    <Link to="/post/$postId" params={{ postId: item.id }} className="block stream-card mx-3 mb-2.5">
      <div className="stream-card__flag">
        <div className="flex items-center gap-1.5 text-c-teal-deep">
          <span>💚</span>
          <span className="text-[10px] font-medium tracking-[0.07em] uppercase">Stream story · Relate resonance</span>
        </div>
        <div className="stream-card__rank">#1 this week</div>
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
          <span className="text-[10px] text-c-teal ml-auto">↗ Never reached court</span>
        </div>
        <div className="text-[13px] font-medium leading-snug mb-1">{item.title || item.storyText.slice(0, 100)}</div>
        <div className="rounded-xl bg-c-teal-soft border border-c-teal-border p-2.5 mt-2">
          <div className="text-[10px] font-medium tracking-[0.06em] uppercase text-c-teal-deep mb-0.5">Why it's here</div>
          <div className="text-[13px] font-medium text-c-teal">{fmt(item.likeCount)} relate taps</div>
          <div className="text-[11px] text-c-teal-deep">Recognition without verdict. The highest relate count of the week.</div>
        </div>
        <div className="flex gap-2 flex-wrap mt-2 text-[10px] text-c-text-3">
          <span>💬 {fmt(item.commentCount)} comments</span>
          <span>👥 {fmt(item.verdictCount)} verdicts</span>
          <span>Stream only</span>
        </div>
      </div>
    </Link>
  );
}

function TopJurorCard() {
  // No leaderboard wiring yet. Render a Bench-voice placeholder honouring the design.
  return (
    <div className="user-card mx-3 mb-3">
      <div className="user-card__flag">
        <div className="text-[10px] font-medium tracking-[0.07em] uppercase text-c-purple-deep flex items-center gap-1">
          <span>👑</span> Legend of the court
        </div>
        <div className="user-card__rank">Pending</div>
      </div>
      <div className="p-3.5 flex gap-3 items-start">
        <div className="w-11 h-11 rounded-full bg-c-purple-soft border-[1.5px] border-c-purple-border flex items-center justify-center text-[22px] flex-shrink-0">
          🦉
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium">The bench is still tallying.</div>
          <div className="text-[11px] text-c-purple-deep mb-1.5">The first crown is yours to take.</div>
          <Link to="/court" className="inline-block text-[11px] font-medium text-c-purple underline">
            Go cast verdicts →
          </Link>
        </div>
      </div>
    </div>
  );
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

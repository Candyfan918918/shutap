// The home story stream for signed-in users.
// Visual reference: shutap_stream_feed.html (unified design system v3).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { listTrendingFeed, type FeedItem } from "@/lib/posts/feed.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";


const feedQO = queryOptions({
  queryKey: ["home-stream", "trending"],
  queryFn: async () => {
    const fn = listTrendingFeed as unknown as (
      args?: { data?: { sort?: "trending" | "latest"; limit?: number } },
    ) => Promise<FeedItem[]>;
    return fn({ data: { sort: "trending", limit: 24 } });
  },
  staleTime: 30_000,
});

const meQO = queryOptions({
  queryKey: ["me", "stream-header"],
  queryFn: async () => {
    const fn = getMyProfile as unknown as () => Promise<Record<string, unknown> | null>;
    return fn();
  },
  staleTime: 60_000,
});

export const Route = createFileRoute("/stream")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(feedQO);
  },
  component: StreamPage,
  head: () => ({
    meta: [
      { title: "Shutap — your story stream" },
      { name: "description", content: "Real anonymous stories. One stream. The bench voice." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm text-c-text-2">The stream is between stories.</p>
      <p className="text-xs text-c-text-3 break-words">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm">
        Reload
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-c-text-2 text-sm">Nothing on the docket.</div>
  ),
});

function categoryFor(scoreCategory: string | null): { label: string; cls: string } {
  const c = (scoreCategory ?? "").toLowerCase();
  if (c.includes("famil") || c.includes("mother") || c.includes("mil")) return { label: "Family", cls: "cat-pill--family" };
  if (c.includes("work") || c.includes("money")) return { label: "Work", cls: "cat-pill--work" };
  if (c.includes("stranger") || c.includes("neigh")) return { label: "Stranger", cls: "cat-pill--stranger" };
  if (c.includes("digital") || c.includes("online")) return { label: "Digital", cls: "cat-pill--digital" };
  return { label: "Romance", cls: "cat-pill--romance" };
}

function useAuthed() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setAuthed(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return authed;
}

function StreamPage() {
  const fetchFeed = useServerFn(listTrendingFeed);
  const fetchMe = useServerFn(getMyProfile);
  const authed = useAuthed();
  const feedQ = useSuspenseQuery({
    ...feedQO,
    queryFn: () => (fetchFeed as unknown as (a: { data: { sort: "trending"; limit: 24 } }) => Promise<FeedItem[]>)({
      data: { sort: "trending", limit: 24 },
    }),
  });
  const meQ = useQuery({
    ...meQO,
    enabled: !!authed,
    queryFn: () => (fetchMe as unknown as () => Promise<Record<string, unknown> | null>)(),
  });

  const me = meQ.data;
  const aliasEmoji = (me?.emoji as string | undefined) ?? "🦉";
  const aliasName = (me?.nickname as string | undefined) ?? "Anonymous Juror";

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-medium tracking-tight">
            shut<span className="text-c-pink-deep">ap</span>
          </Link>
          {authed ? (
            <Link to="/me" className="alias-pill">
              <span className="text-base leading-none">{aliasEmoji}</span>
              <span className="text-c-pink-ink">{aliasName}</span>
            </Link>
          ) : (
            <Link to="/enter" className="alias-pill">
              <span className="text-base leading-none">👋</span>
              <span className="text-c-pink-ink">Step inside</span>
            </Link>
          )}
        </div>
      </header>


      {/* Stream hero — cream + pink-deep, matches Court */}
      <section className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl border-x border-b border-c-border relative overflow-hidden text-center px-4 pt-6 pb-5 bg-c-surface-2">
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 top-[-10px] text-[88px] font-medium text-c-pink-soft/70 whitespace-nowrap pointer-events-none tracking-tighter select-none"
        >
          STREAM
        </span>
        <div className="relative text-[10px] font-medium tracking-[0.12em] uppercase text-c-pink-deep mb-2">
          The Stream · One feed. No filters.
        </div>
        <h1 className="relative text-[16px] font-medium text-c-text-1 leading-snug mb-1.5 text-balance">
          Today's stories. In the order the Bench thinks you need them.
        </h1>
        <p className="relative text-[12px] italic text-c-text-2 leading-snug">
          Read. Weigh in. Move on.
        </p>
      </section>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl border-x border-c-border px-3 md:px-4 pt-4 pb-32 space-y-3">

        {/* Bench inline nudge */}
        <p className="bench-line !my-0 mx-1 text-[12px]">
          Three stories in. Two verdicts cast. The bench is watching.
        </p>

        {feedQ.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-c-border bg-c-surface-2 p-8 text-center">
            <p className="text-sm text-c-text-2">The stream is quiet. Be the first to spill.</p>
            <Link
              to="/spill"
              className="mt-4 inline-block px-5 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm font-medium border border-c-pink-border"
            >
              ✍️ Spill the tea
            </Link>
          </div>
        ) : (
          feedQ.data.map((p, i) => (
            <FeedStoryCard
              key={p.id}
              item={p}
              insertHof={i === 1}
              insertScan={i === 2}
              insertBench={i === 3 ? "You've scrolled past 4 stories without judging. Not sure where you stand? Take the 2-minute assessment. →" : null}
            />
          ))
        )}

        {/* Chatbot pill — expands into the 5-CTA menu (replaces traditional nav) */}
        <BenchPillMenu />
      </main>
    </div>
  );
}

function BenchPillMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items: Array<{ to: string; emoji: string; label: string; sub: string; cls: string }> = [
    { to: "/spill",  emoji: "✍️", label: "Spill",        sub: "drop a story",         cls: "bg-c-pink-soft text-c-pink-ink border-c-pink-border" },
    { to: "/court",  emoji: "⚖️", label: "Court",        sub: "cast verdicts",        cls: "bg-c-teal-soft text-c-teal-deep border-c-teal-border" },
    { to: "/scan",   emoji: "🧠", label: "Scan",         sub: "read the room",        cls: "bg-c-purple-soft text-c-purple-deep border-c-purple-border" },
    { to: "/stream", emoji: "🌊", label: "Story Stream", sub: "the feed",             cls: "bg-c-amber-soft text-c-amber-deep border-c-amber-border" },
    { to: "/hof",    emoji: "🏆", label: "Hall of Fame", sub: "the legends",          cls: "bg-c-coral-soft text-c-coral-deep border-c-coral-border" },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl px-3 pb-3">
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto"
            />
            <div className="relative pointer-events-auto mb-2 grid grid-cols-2 gap-2 rounded-3xl border border-c-surface-3 bg-c-surface p-2 shadow-2xl">
              {items.map((it) => (
                <Link
                  key={it.label}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left ${it.cls}`}
                >
                  <span className="text-xl leading-none">{it.emoji}</span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{it.label}</span>
                    <span className="block text-[11px] opacity-80">{it.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="chatbot-pill pointer-events-auto w-full justify-center italic"
        >
          {open ? "Close" : "Ask The Bench…"}
        </button>
      </div>
    </div>
  );
}

// Deterministic hash → 0..1 for seeding per-item synthetic data.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

type VerdictSeg = { key: string; label: string; pct: number; color: string; dot: string };

function verdictsFor(id: string, cat: { label: string; cls: string }): VerdictSeg[] {
  const r = hash01(id);
  // Three or four-segment distributions keyed off category flavor.
  if (cat.label === "Work") {
    const a = 65 + Math.round(r * 12);
    const b = 12 + Math.round(r * 10);
    return [
      { key: "rf",  label: "Red flag",  pct: a, color: "#f09595", dot: "#f09595" },
      { key: "law", label: "Lawyer up", pct: b, color: "var(--c-amber-soft)", dot: "var(--c-amber)" },
      { key: "other", label: "Other",  pct: 100 - a - b, color: "var(--c-surface-3)", dot: "var(--c-text-3)" },
    ];
  }
  if (cat.label === "Family") {
    const a = 40 + Math.round(r * 14);
    const b = 28 + Math.round(r * 10);
    const c = 14 + Math.round(r * 6);
    return [
      { key: "rf",   label: "Red flag",    pct: a, color: "#f09595",                dot: "#f09595" },
      { key: "th",   label: "Therapy",     pct: b, color: "var(--c-purple-soft)",   dot: "var(--c-purple)" },
      { key: "talk", label: "Talk it out", pct: c, color: "var(--c-pink-soft)",     dot: "var(--c-pink-deep)" },
      { key: "other",label: "Other",       pct: Math.max(0, 100 - a - b - c), color: "var(--c-surface-3)", dot: "var(--c-text-3)" },
    ];
  }
  if (cat.label === "Stranger") {
    const a = 60 + Math.round(r * 10);
    const b = 20 + Math.round(r * 8);
    return [
      { key: "law", label: "Lawyer up", pct: a, color: "var(--c-amber-soft)", dot: "var(--c-amber)" },
      { key: "rf",  label: "Red flag",  pct: b, color: "#f09595", dot: "#f09595" },
      { key: "other", label: "Other", pct: 100 - a - b, color: "var(--c-surface-3)", dot: "var(--c-text-3)" },
    ];
  }
  // Romance / Digital / default
  const a = 45 + Math.round(r * 18);
  const b = 20 + Math.round(r * 12);
  const c = 10 + Math.round(r * 8);
  return [
    { key: "rf",   label: "Red flag",    pct: a, color: "#f09595",              dot: "#f09595" },
    { key: "talk", label: "Talk it out", pct: b, color: "var(--c-pink-soft)",   dot: "var(--c-pink-deep)" },
    { key: "gf",   label: "Green flag",  pct: c, color: "#eaf3de",              dot: "var(--c-green-flag)" },
    { key: "other",label: "Other",       pct: Math.max(0, 100 - a - b - c), color: "var(--c-surface-3)", dot: "var(--c-text-3)" },
  ];
}

const CAT_BUBBLE_BG: Record<string, string> = {
  Romance:  "var(--c-pink-soft)",
  Family:   "var(--c-teal-soft)",
  Work:     "var(--c-amber-soft)",
  Stranger: "var(--c-coral-soft)",
  Digital:  "var(--c-purple-soft)",
};

const AUTHOR_EMOJIS = ["🦅", "🌿", "🦋", "🦎", "🐙", "🦊", "🦉", "🐬", "🌺", "🐦"];

// Split body into intro + italic question (last sentence ending in "?").
function splitBody(text: string): { intro: string; question: string | null } {
  const trimmed = text.trim();
  const m = trimmed.match(/(.*?)([^.!?\n]*\?)\s*$/s);
  if (m && m[2] && m[2].length < trimmed.length) {
    return { intro: m[1].trim(), question: m[2].trim() };
  }
  return { intro: trimmed, question: null };
}

function FeedStoryCard({
  item,
  insertHof,
  insertScan,
  insertBench,
}: {
  item: FeedItem;
  insertHof: boolean;
  insertScan: boolean;
  insertBench: string | null;
}) {
  const cat = categoryFor(item.scoreCategory);
  const segs = verdictsFor(item.id, cat);
  const bubbleBg = CAT_BUBBLE_BG[cat.label] ?? "var(--c-pink-soft)";
  const authorEmoji = AUTHOR_EMOJIS[Math.floor(hash01(item.id) * AUTHOR_EMOJIS.length)];
  const source = item.isSeed ? "via Scan" : "via Spill";
  const body = splitBody(item.storyText.slice(0, 360));
  const verdictTotal = Math.max(0, item.verdictCount);

  return (
    <>
      <article className="feed-card">
        <div className="feed-card__header">
          <div className="author-bubble" style={{ background: bubbleBg }}>{authorEmoji}</div>
          <div className="flex-1 leading-tight min-w-0">
            <div className="text-[11px] md:text-[12px] font-medium text-c-text-1 truncate">
              {item.author?.nickname ?? "Anonymous Juror"}
            </div>
            <div className="text-[10px] md:text-[11px] text-c-text-3">{source} · {timeAgo(item.publishedAt)}</div>
          </div>
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
        </div>

        <Link to="/post/$postId" params={{ postId: item.id }} className="block feed-card__body">
          {body.intro.split(/\n{2,}/).map((para, i) => (
            <p key={i} className={i === 0 ? "" : "mt-3"}>{para}</p>
          ))}
          {body.question && (
            <p className="mt-3"><em>"{body.question}"</em></p>
          )}
          {item.storyText.length > 360 && <span className="text-c-text-3"> …</span>}
        </Link>

        <div className="feed-card__verdict-row">
          <div className="vbar">
            {segs.map((s) => (
              <div key={s.key} className="vs" style={{ width: `${s.pct}%`, background: s.color }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {segs.slice(0, 3).map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] text-c-text-3">
                <span className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: s.dot }} />
                {s.label} {s.pct}%
              </span>
            ))}
            <span className="ml-auto text-[10px] md:text-[11px] text-c-text-3">
              {verdictTotal.toLocaleString()} verdicts
            </span>
          </div>
        </div>

        <div className="feed-card__actions">
          <Link
            to="/post/$postId"
            params={{ postId: item.id }}
            className="act-btn act-btn--vote"
          >
            ⚖️ Judge this
          </Link>
          <button type="button" className="act-btn act-btn--relate">💚 Happened to me</button>
          <span className="flex-1" />
          <button type="button" className="act-btn act-btn--icon" aria-label="Share">↗</button>
        </div>
      </article>

      {insertHof && (
        <Link to="/hof" className="hof-strip block mx-1">
          <div className="hof-strip__label">🏆 Hall of fame · Most relatable this week</div>
          <div className="hof-strip__title">
            I found out my best friend of 12 years had a whole other friend group she never mentioned.
          </div>
          <div className="hof-strip__meta">14,201 verdicts · 3,812 relate · Outcome confirmed</div>
        </Link>
      )}

      {insertScan && (
        <section className="scan-strip">
          <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-medium tracking-[0.07em] uppercase text-c-pink-ink">
            Scan result · Stranger
          </div>
          <div className="scan-strip__score">Drama score: 780</div>
          <div className="scan-strip__summary">
            A one-sided conflict with a service provider where power dynamics are clearly at play.
            High likelihood of a justified complaint. Community would likely side with you.
          </div>
          <div className="flex gap-2 px-3.5 pt-2 pb-2.5 border-t border-c-pink-border bg-c-surface">
            <button type="button" className="flex-1 text-center text-[11px] font-medium py-1.5 rounded-[10px] border border-c-surface-3 bg-c-surface-2 text-c-text-2">
              Save privately
            </button>
            <Link
              to="/spill"
              className="flex-1 text-center text-[11px] font-medium py-1.5 rounded-[10px] border border-c-pink-border bg-c-pink-soft text-c-pink-ink"
            >
              Post to feed →
            </Link>
          </div>
        </section>
      )}

      {insertBench && (
        <div className="bench-line !my-0 mx-1 text-[12px]">
          {insertBench}
        </div>
      )}
    </>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}


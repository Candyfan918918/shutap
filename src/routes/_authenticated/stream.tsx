// The home story stream for signed-in users.
// Visual reference: shutap_stream_feed.html (unified design system v3).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { listTrendingFeed, type FeedItem } from "@/lib/posts/feed.functions";
import { getMyProfile } from "@/lib/profile.functions";


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

export const Route = createFileRoute("/_authenticated/stream")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(feedQO);
    void context.queryClient.ensureQueryData(meQO);
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

function StreamPage() {
  const fetchFeed = useServerFn(listTrendingFeed);
  const fetchMe = useServerFn(getMyProfile);
  const feedQ = useSuspenseQuery({
    ...feedQO,
    queryFn: () => (fetchFeed as unknown as (a: { data: { sort: "trending"; limit: 24 } }) => Promise<FeedItem[]>)({
      data: { sort: "trending", limit: 24 },
    }),
  });
  const meQ = useSuspenseQuery({
    ...meQO,
    queryFn: () => (fetchMe as unknown as () => Promise<Record<string, unknown> | null>)(),
  });

  const me = meQ.data;
  const aliasEmoji = (me?.emoji as string | undefined) ?? "🦉";
  const aliasName = (me?.nickname as string | undefined) ?? "Anonymous Juror";

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-medium tracking-tight">shutap</span>
          <Link to="/me" className="alias-pill">
            <span className="text-base leading-none">{aliasEmoji}</span>
            <span className="text-c-pink-ink">{aliasName}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-3 pt-3 pb-32 space-y-3">
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
          feedQ.data.map((p, i) => <FeedStoryCard key={p.id} item={p} insertHof={i === 4} />)
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
      <div className="mx-auto max-w-xl px-3 pb-3">
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
          {open ? "Close" : "Ask Bench anything · or pick a room →"}
        </button>
      </div>
    </div>
  );
}


function FeedStoryCard({ item, insertHof }: { item: FeedItem; insertHof: boolean }) {
  const cat = categoryFor(item.scoreCategory);
  const total = Math.max(1, item.verdictCount);
  // Synthetic distribution to render the bar (until verdict-by-kind is wired).
  const segs = [
    { color: "#f09595", pct: 58 },
    { color: "var(--c-pink-soft)", pct: 21 },
    { color: "var(--c-teal-soft)", pct: 13 },
    { color: "var(--c-amber-soft)", pct: 8 },
  ];

  return (
    <>
      <article className="feed-card">
        <div className="feed-card__header">
          <div className="author-bubble" style={{ background: "var(--c-pink-soft)" }}>🦅</div>
          <div className="flex-1 leading-tight">
            <div className="text-[11px] font-medium text-c-text-1">{item.author?.nickname ?? "Anonymous"}</div>
            <div className="text-[10px] text-c-text-3">via Spill · {timeAgo(item.publishedAt)}</div>
          </div>
          <span className={`cat-pill ${cat.cls}`}>{cat.label}</span>
        </div>
        <Link to="/post/$postId" params={{ postId: item.id }} className="block feed-card__body">
          {item.storyText.slice(0, 240)}
          {item.storyText.length > 240 ? "…" : ""}
        </Link>
        <div className="feed-card__verdict-row">
          <div className="vbar">
            {segs.map((s, i) => (
              <div key={i} className="vs" style={{ width: `${s.pct}%`, background: s.color }} />
            ))}
          </div>
          <div className="text-[10px] text-c-text-3">{item.verdictCount} verdicts · {total} jurors</div>
        </div>
        <div className="feed-card__actions">
          <button className="act-btn act-btn--vote">⚖️ Vote</button>
          <button className="act-btn act-btn--relate">💚 Relate</button>
          <span className="flex-1" />
          <button className="act-btn act-btn--icon" aria-label="Share">↗</button>
        </div>
      </article>

      {insertHof && (
        <Link to="/hof" className="hof-strip block mx-1">
          <div className="hof-strip__label">🏆 Hall of Fame · This week</div>
          <div className="hof-strip__title">Most dramatic case of the week is up for grabs.</div>
          <div className="hof-strip__meta">Cast a verdict → climb the ladder</div>
        </Link>
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

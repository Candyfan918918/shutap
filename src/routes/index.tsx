// Anonymous Court landing page — the first screen any visitor sees.
// Watching is free. Participating requires identity. Every action gates on tap.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFeaturedCourtCase,
  getGlobalVerdictCount,
  getTeaserFeed,
  getOpenCaseCount,
  getHallOfFame,
  type FeaturedCase,
  type TeaserPost,
  type HallOfFame,
  type HofDramatic,
  type HofRelatable,
  type HofSurprising,
} from "@/lib/court.functions";

import { listComments, type CommentRow } from "@/lib/posts/community.functions";
import { supabase } from "@/integrations/supabase/client";
import shutapIcon from "@/assets/shutap-favicon-32.png.asset.json";
import shutapLogo from "@/assets/shutap-logo-light.png.asset.json";

export const Route = createFileRoute("/")({
  component: AnonymousCourt,
  head: () => ({
    meta: [
      { title: "Shutap — 👑 Relationship Court™" },
      {
        name: "description",
        content:
          "The internet decides. Read the case, watch the verdict bar move in real time. Zero real names exposed.",
      },
      { property: "og:title", content: "Shutap — Relationship Court™" },
      {
        property: "og:description",
        content: "Watch the world decide. Zero real names exposed.",
      },
      { property: "og:type", content: "website" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
  }),
});

// ───────────────────────── Verdict labels ─────────────────────────

const VERDICTS: Array<{ kind: string; emoji: string; label: string; color: string }> = [
  { kind: "red_flag", emoji: "🚩", label: "Red Flag", color: "oklch(0.62 0.22 25)" },
  { kind: "green_flag", emoji: "💚", label: "Green Flag", color: "oklch(0.65 0.18 145)" },
  { kind: "run", emoji: "🏃", label: "RUN", color: "oklch(0.6 0.24 18)" },
  { kind: "talk_it_out", emoji: "🗣", label: "Talk It Out", color: "oklch(0.7 0.15 80)" },
  { kind: "lawyer_up", emoji: "⚖️", label: "Lawyer Up", color: "oklch(0.55 0.2 285)" },
  { kind: "therapy_might_help", emoji: "🛋", label: "Therapy", color: "oklch(0.68 0.15 200)" },
  { kind: "need_update", emoji: "👀", label: "Need Update", color: "oklch(0.7 0.05 280)" },
];

const JUDGMENTS: Array<{ kind: string; emoji: string; label: string }> = [
  { kind: "guilty", emoji: "👎", label: "Guilty" },
  { kind: "not_guilty", emoji: "👍", label: "Not Guilty" },
  { kind: "both_at_fault", emoji: "🤷", label: "Both At Fault" },
  { kind: "need_more", emoji: "👀", label: "Need More" },
];

// ───────────────────────── Page ─────────────────────────

function AnonymousCourt() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthed(!!data.session);
    });
    return () => { active = false; };
  }, []);

  const gate = (intent: string) => {
    navigate({ to: "/enter", search: { redirect: `/?intent=${intent}` } });
  };

  const fetchFeatured = useServerFn(getFeaturedCourtCase);
  const fetchGlobal = useServerFn(getGlobalVerdictCount);
  const fetchTeaser = useServerFn(getTeaserFeed);
  const fetchOpenCases = useServerFn(getOpenCaseCount);
  const fetchHof = useServerFn(getHallOfFame);

  const featuredQ = useQuery({
    queryKey: ["anon-court", "featured"],
    queryFn: () => fetchFeatured(),
    refetchInterval: 8_000,
    staleTime: 0,
  });
  const globalQ = useQuery({
    queryKey: ["anon-court", "global-verdicts"],
    queryFn: () => fetchGlobal(),
    refetchInterval: 5_000,
    staleTime: 0,
  });
  const teaserQ = useQuery({
    queryKey: ["anon-court", "teaser", featuredQ.data?.case.post?.id ?? "none"],
    queryFn: () => fetchTeaser({ data: { excludePostId: featuredQ.data?.case.post?.id } }),
    enabled: featuredQ.isSuccess,
    staleTime: 60_000,
  });
  const openCasesQ = useQuery({
    queryKey: ["anon-court", "open-cases"],
    queryFn: () => fetchOpenCases(),
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const hofQ = useQuery<HallOfFame>({
    queryKey: ["anon-court", "hof"],
    queryFn: () => fetchHof(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });


  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      <TrustSignalBar total={globalQ.data?.total ?? null} />
      <TopChrome authed={authed} />

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6 space-y-8">
        <HeroIntro />
        {featuredQ.isLoading ? (
          <CaseSkeleton />
        ) : featuredQ.data ? (
          <CaseView featured={featuredQ.data} onGate={gate} />
        ) : (
          <CourtInRecess />
        )}
        <TeaserFeedSection
          posts={teaserQ.data ?? []}
          isLoading={teaserQ.isLoading}
          openCases={openCasesQ.data?.count ?? 0}
          onGate={gate}
          excludePostId={featuredQ.data?.case.post?.id}
        />
        <HallOfFameSection hof={hofQ.data ?? null} isLoading={hofQ.isLoading} onGate={gate} />
        <FinalCTA onGate={gate} />

      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-muted-foreground space-y-1">
          <p>⚠️ Real stories, real opinions. Not legal or therapeutic advice.</p>
          <p>Made with chaos, worldwide.</p>
        </div>
      </footer>
    </div>
  );
}

// ───────────────────────── Trust signal bar ─────────────────────────

function TrustSignalBar({ total }: { total: number | null }) {
  // Smoothly tween the visible count so updates feel live.
  const [display, setDisplay] = useState<number | null>(total);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (total == null) return;
    if (last.current == null) {
      last.current = total;
      setDisplay(total);
      return;
    }
    const from = last.current;
    const to = total;
    if (from === to) return;
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setDisplay(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else last.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div className="w-full border-b border-border bg-surface-elevated/80 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-1.5 flex items-center justify-between text-[12px] text-muted-foreground font-normal">
        <span className="flex items-center gap-1.5">
          <span className="relative inline-block h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="absolute inset-0 rounded-full bg-emerald-500" />
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {display != null ? display.toLocaleString() : "—"}
            </span>{" "}
            verdicts cast
          </span>
        </span>
        <span>Zero real names exposed.</span>
      </div>
    </div>
  );
}

function TopChrome({ authed }: { authed: boolean | null }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border">
      <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <img src={shutapLogo.url} alt="Shutap" className="hidden sm:block h-7 w-auto" />
          <img src={shutapIcon.url} alt="Shutap" className="sm:hidden h-7 w-auto" />
        </div>
        {authed ? (
          <Link
            to="/court"
            className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
          >
            Enter Court →
          </Link>
        ) : (
          <Link
            to="/enter"
            search={{ redirect: "/" }}
            className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
          >
            Claim my identity →
          </Link>
        )}
      </div>
    </header>
  );
}

function HeroIntro() {
  return (
    <section className="text-center pt-2">
      <motion.h1
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-5xl font-bold tracking-tight text-balance"
      >
        👑 Relationship Court™
      </motion.h1>
      <p className="mt-2 text-sm sm:text-base text-muted-foreground">
        Where the <span className="text-foreground font-semibold">internet</span> decides.
      </p>
    </section>
  );
}

function CourtInRecess() {
  return (
    <section className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-2xl">⚖️</p>
      <p className="mt-2 font-semibold">Court is in recess.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The jury is between cases. The next one drops shortly.
      </p>
    </section>
  );
}

function CaseSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-2/3 bg-surface-elevated rounded animate-pulse" />
      <div className="h-40 bg-surface-elevated rounded-2xl animate-pulse" />
      <div className="h-24 bg-surface-elevated rounded-2xl animate-pulse" />
    </div>
  );
}

// ───────────────────────── Case ─────────────────────────

function CaseView({
  featured,
  onGate,
}: {
  featured: FeaturedCase;
  onGate: (intent: string) => void;
}) {
  const c = featured.case;
  const post = c.post!;
  const alias = featured.author?.handle ?? "anonymous";
  const aliasNick = featured.author?.nickname ?? "Anonymous Juror";

  const categoryLabel = (post.scoreCategory ?? "Relationship").replace(/_/g, " ");
  const tier =
    c.status === "legendary"
      ? "Legendary"
      : c.status === "decided"
        ? "Final Decision"
        : c.status === "judgment_pending"
          ? "Judgment Pending"
          : c.status === "in_court"
            ? "Live Trial"
            : "Nominated";

  return (
    <article className="space-y-6">
      <CourtRibbon
        category={categoryLabel}
        tier={tier}
        closesAt={c.closesAt}
        regionLabel={c.regionLabel}
      />

      <div className="flex items-center gap-3">
        <AliasPill handle={alias} nickname={aliasNick} avatarUrl={featured.author?.avatarUrl ?? null} />
        <div className="flex flex-wrap gap-1.5">
          <Pill>💔 {categoryLabel}</Pill>
          {post.score != null && <Pill>🔥 {post.score} chaos</Pill>}
        </div>
      </div>

      <div className="rounded-2xl border-l-4 border-primary bg-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          The case
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight text-balance">
          {post.title}
        </h2>
        <p className="mt-3 italic text-muted-foreground text-sm">
          Question before court: <span className="text-foreground">What would you do?</span>
        </p>
      </div>

      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-200">
        ⚠️ One person's account — the other party has not responded.
      </div>

      {post.mediaUrl && (
        <div className="rounded-2xl overflow-hidden border border-border">
          <img src={post.mediaUrl} alt="" className="w-full h-auto object-cover" />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
          {post.storyText}
        </p>
      </div>

      <VerdictBar
        counts={c.verdict.counts as unknown as Record<string, number>}
        total={c.verdict.total}
      />

      <VoteGrid onGate={() => onGate("vote")} />

      <ActionRow
        relates={featured.totalRelates}
        comments={post.commentCount}
        shares={post.shareCount}
        caseUrl={typeof window !== "undefined" ? window.location.href : ""}
        onRelate={() => onGate("relate")}
      />

      <JudgmentRow onGate={() => onGate("judgment")} />

      <CommentSection postId={post.id} onGate={() => onGate("comment")} />
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-muted-foreground">
      {children}
    </span>
  );
}

function AliasPill({
  handle,
  nickname,
  avatarUrl,
}: {
  handle: string;
  nickname: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-elevated border border-border">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent" />
      )}
      <div className="leading-tight">
        <div className="text-xs font-semibold">{nickname}</div>
        <div className="text-[10px] text-muted-foreground">@{handle}</div>
      </div>
    </div>
  );
}

function CourtRibbon({
  category,
  tier,
  closesAt,
  regionLabel,
}: {
  category: string;
  tier: string;
  closesAt: string | null;
  regionLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = closesAt ? new Date(closesAt).getTime() - now : null;
  const countdown = (() => {
    if (remaining == null) return "open indefinitely";
    if (remaining <= 0) return "verdict landed";
    const totalMin = Math.floor(remaining / 60_000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const s = Math.floor((remaining % 60_000) / 1000);
    if (d > 0) return `${d}d ${h}h to verdict`;
    if (h > 0) return `${h}h ${m}m to verdict`;
    if (m > 0) return `${m}m ${s}s to verdict`;
    return `${s}s to verdict`;
  })();
  return (
    <div className="flex items-center justify-between rounded-full border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-2 text-xs font-semibold">
      <span className="text-foreground">
        {category} Court · {tier}
      </span>
      <span className="text-primary tabular-nums">⏳ {countdown}</span>
      <span className="hidden sm:inline text-muted-foreground">{regionLabel}</span>
    </div>
  );
}

// ───────────────────────── Verdict bar ─────────────────────────

function VerdictBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const segments = VERDICTS.map((v) => ({
    ...v,
    n: counts[v.kind] ?? 0,
    pct: total > 0 ? ((counts[v.kind] ?? 0) / total) * 100 : 100 / VERDICTS.length,
  }));
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between text-xs">
        <span className="font-semibold">Live verdict</span>
        <span className="text-muted-foreground">
          <span className="tabular-nums text-foreground font-semibold">
            {total.toLocaleString()}
          </span>{" "}
          juror{total === 1 ? "" : "s"} weighed in
        </span>
      </div>
      <div className="h-8 w-full rounded-full overflow-hidden flex border border-border bg-surface-elevated">
        {segments.map((s) => (
          <motion.div
            key={s.kind}
            layout
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
            style={{ background: s.color }}
            className="h-full flex items-center justify-center text-[10px] font-bold text-black/80"
            title={`${s.label}: ${Math.round(s.pct)}%`}
          >
            {s.pct > 8 ? `${s.emoji} ${Math.round(s.pct)}%` : ""}
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.kind}>
            <span style={{ color: s.color }}>●</span> {s.emoji} {s.label}{" "}
            <span className="tabular-nums text-foreground">{Math.round(s.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Vote / Judgment / Action rows ─────────────────────────

function GateButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative group rounded-xl border border-border bg-card hover:border-primary/60 hover:bg-surface-elevated transition px-3 py-2.5 text-sm font-semibold text-left ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-background/85 opacity-0 group-hover:opacity-100 transition text-xs font-bold text-primary">
        Join to vote →
      </span>
    </button>
  );
}

function VoteGrid({ onGate }: { onGate: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Cast your verdict
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VERDICTS.map((v) => (
          <GateButton key={v.kind} onClick={onGate}>
            <span className="mr-1.5">{v.emoji}</span>
            {v.label}
          </GateButton>
        ))}
      </div>
    </div>
  );
}

function JudgmentRow({ onGate }: { onGate: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Final judgment
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {JUDGMENTS.map((j) => (
          <GateButton key={j.kind} onClick={onGate}>
            <span className="mr-1.5">{j.emoji}</span>
            {j.label}
          </GateButton>
        ))}
      </div>
    </div>
  );
}

function ActionRow({
  relates,
  comments,
  shares,
  caseUrl,
  onRelate,
}: {
  relates: number;
  comments: number;
  shares: number;
  caseUrl: string;
  onRelate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caseUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onRelate}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary/60 transition"
      >
        <span>❤️</span>
        <span>It happened to me</span>
        <span className="tabular-nums text-muted-foreground">
          · {relates.toLocaleString()} felt this
        </span>
      </button>
      <span className="text-xs text-muted-foreground">💬 {comments.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">📤 {shares.toLocaleString()}</span>
      <button
        onClick={copy}
        className="ml-auto flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold hover:border-primary/60 transition"
      >
        <span>🔗</span>
        <span>{copied ? "Link copied." : "Share this case"}</span>
      </button>
    </div>
  );
}

// ───────────────────────── Comments ─────────────────────────

function CommentSection({ postId, onGate }: { postId: string; onGate: () => void }) {
  const fetchComments = useServerFn(listComments);
  const q = useQuery({
    queryKey: ["anon-court", "comments", postId],
    queryFn: () => fetchComments({ data: { postId, sort: "top", limit: 25 } }),
    refetchInterval: 15_000,
    staleTime: 0,
  });
  const list: CommentRow[] = q.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">💬 Comments ({list.length})</p>
        <span className="text-[11px] text-muted-foreground">Top first</span>
      </div>

      <button
        onClick={onGate}
        className="w-full text-left rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted-foreground hover:border-primary/60 transition"
      >
        What would you do?
      </button>

      <div className="space-y-3">
        <AnimatePresence>
          {list.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.author?.avatarUrl ? (
                  <img src={c.author.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-accent" />
                )}
                <span className="font-semibold text-foreground">
                  {c.author?.nickname ?? "Anonymous"}
                </span>
                <span>@{c.author?.handle ?? "anon"}</span>
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{c.body}</p>
              <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                <span>❤️ {c.likeCount}</span>
                <span>😂 {c.funnyCount}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!q.isLoading && list.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No comments yet. The jury is reading.
          </p>
        )}
      </div>
    </section>
  );
}

// ───────────────────────── Bottom CTA ─────────────────────────

function BottomCTA({ onGate }: { onGate: (intent: string) => void }) {
  return (
    <section className="rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 text-center">
      <p className="text-lg font-bold text-balance">
        The court is in session.
      </p>
      <p className="mt-1 text-sm text-muted-foreground text-balance">
        Claim your identity to vote, relate, and submit your own case.
      </p>
      <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => onGate("claim")}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm shadow-lg"
        >
          Claim my identity →
        </button>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Keep reading ↑
        </a>
      </div>
    </section>
  );
}

// ───────────────────────── Teaser Feed ─────────────────────────

function TeaserFeedSection({
  posts,
  isLoading,
  openCases,
  onGate,
}: {
  posts: TeaserPost[];
  isLoading: boolean;
  openCases: number;
  onGate: (intent: string) => void;
  excludePostId?: string;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">
          While you were reading, the court was busy.
        </p>
        <div className="space-y-4">
          <TeaserSkeleton />
          <TeaserSkeleton />
          <TeaserSkeleton />
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="space-y-5 pt-4">
      <p className="text-sm font-semibold text-muted-foreground tracking-tight">
        While you were reading, the court was busy.
      </p>

      <div className="space-y-4">
        {posts.map((post) => (
          <TeaserCard key={post.id} post={post} onGate={() => onGate("teaser")} />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">
          <span className="tabular-nums font-bold">{openCases.toLocaleString()}</span>{" "}
          cases open right now. Every one has a verdict forming.
        </p>
        <button
          onClick={() => onGate("claim")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Claim your identity to access them all →
        </button>
      </div>
    </section>
  );
}

function TeaserSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="h-5 w-1/3 bg-surface-elevated rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-surface-elevated rounded animate-pulse" />
      <div className="h-16 bg-surface-elevated rounded animate-pulse" />
    </div>
  );
}

function TeaserCard({
  post,
  onGate,
}: {
  post: TeaserPost;
  onGate: () => void;
}) {
  const categoryLabel = (post.scoreCategory ?? "Relationship").replace(/_/g, " ");
  const wordLimit = 50;
  const words = post.storyText?.split(/\s+/) ?? [];
  const snippet = words.slice(0, wordLimit).join(" ");
  const hasMore = words.length > wordLimit;

  return (
    <button
      onClick={onGate}
      className="w-full text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition group"
    >
      <div className="p-4 space-y-3">
        {/* Author + badges */}
        <div className="flex flex-wrap items-center gap-2">
          {post.author && (
            <AliasPill
              handle={post.author.handle}
              nickname={post.author.nickname}
              avatarUrl={post.author.avatarUrl}
            />
          )}
          <Pill>💔 {categoryLabel}</Pill>
          {post.score != null && <Pill>🔥 {post.score} chaos</Pill>}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold leading-tight text-balance">
          {post.title}
        </h3>

        {/* Story snippet with fade */}
        <div className="relative">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {snippet}
            {hasMore ? "…" : ""}
          </p>
          {hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>

        {/* Equal verdict bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Live verdict</span>
            <span className="text-muted-foreground">
              — Join to see verdicts →
            </span>
          </div>
          <div className="h-6 w-full rounded-full overflow-hidden flex border border-border bg-surface-elevated opacity-60">
            {VERDICTS.map((v) => (
              <div
                key={v.kind}
                style={{
                  width: `${100 / VERDICTS.length}%`,
                  background: v.color,
                }}
                className="h-full"
              />
            ))}
          </div>
        </div>

        {/* Engagement counts */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>❤️ {post.relateCount.toLocaleString()} felt this</span>
          <span>💬 {post.commentCount.toLocaleString()}</span>
          <span>📤 {post.shareCount.toLocaleString()}</span>
        </div>
      </div>
    </button>
  );
}

// ───────────────────────── Hall of Fame ─────────────────────────

function HallOfFameSection({
  hof,
  isLoading,
  onGate,
}: {
  hof: HallOfFame | null;
  isLoading: boolean;
  onGate: (intent: string) => void;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4 pt-4">
        <p className="text-sm font-semibold text-muted-foreground tracking-tight">
          The court has a memory.
        </p>
        <div className="space-y-4">
          <TeaserSkeleton />
          <TeaserSkeleton />
          <TeaserSkeleton />
        </div>
      </section>
    );
  }
  if (!hof || (!hof.dramatic && !hof.relatable && !hof.surprising)) return null;

  return (
    <section className="space-y-5 pt-4">
      <p className="text-sm font-semibold text-muted-foreground tracking-tight">
        The court has a memory.
      </p>
      <div className="space-y-4">
        {hof.dramatic && (
          <HofDramaticCard post={hof.dramatic} onGate={() => onGate("hof_dramatic")} />
        )}
        {hof.relatable && (
          <HofRelatableCard post={hof.relatable} onGate={() => onGate("hof_relatable")} />
        )}
        {hof.surprising && (
          <HofSurprisingCard post={hof.surprising} onGate={() => onGate("hof_surprising")} />
        )}
      </div>

      <div className="text-center pt-2">
        <p className="text-sm font-medium text-foreground">
          Join{" "}
          <span className="tabular-nums font-bold">
            {hof.todayVotes.toLocaleString()}
          </span>{" "}
          people who've weighed in today.
        </p>
      </div>
    </section>
  );
}

function HofLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
      style={{ color, borderColor: color, borderWidth: 0.5, borderStyle: "solid" }}
    >
      {children}
    </span>
  );
}

function HofDramaticCard({ post, onGate }: { post: HofDramatic; onGate: () => void }) {
  const amber = "oklch(0.78 0.16 75)";
  return (
    <button
      onClick={onGate}
      className="w-full text-left rounded-2xl bg-card overflow-hidden hover:bg-surface-elevated transition group"
      style={{ borderColor: amber, borderWidth: 0.5, borderStyle: "solid" }}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <HofLabel color={amber}>🔥 Most Dramatic Today</HofLabel>
          {post.score != null && (
            <span className="text-[11px] tabular-nums font-semibold" style={{ color: amber }}>
              {post.score} chaos
            </span>
          )}
        </div>
        <h3 className="text-xl sm:text-2xl font-bold leading-tight text-balance">
          {post.title}
        </h3>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {post.verdictTotal.toLocaleString()} jurors weighed in
        </p>
        <VerdictBar counts={post.verdictCounts} total={post.verdictTotal} />
        <p className="text-sm italic text-foreground/90 pt-1">
          “{post.benchVerdictLine}”
        </p>
        <p className="text-[11px] font-semibold text-primary pt-1">
          Read the full case →
        </p>
      </div>
    </button>
  );
}

function HofRelatableCard({ post, onGate }: { post: HofRelatable; onGate: () => void }) {
  const teal = "oklch(0.72 0.14 195)";
  const words = post.storyText?.split(/\s+/) ?? [];
  const snippet = words.slice(0, 60).join(" ");
  const hasMore = words.length > 60;
  const categoryLabel = (post.scoreCategory ?? "Relationship").replace(/_/g, " ");
  return (
    <button
      onClick={onGate}
      className="w-full text-left rounded-2xl bg-card overflow-hidden hover:bg-surface-elevated transition group"
      style={{ borderColor: teal, borderWidth: 0.5, borderStyle: "solid" }}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <HofLabel color={teal}>💚 Most Relatable This Week</HofLabel>
          <Pill>💔 {categoryLabel}</Pill>
        </div>
        <h3 className="text-lg sm:text-xl font-bold leading-tight text-balance">
          {post.title}
        </h3>
        <p className="text-sm font-semibold" style={{ color: teal }}>
          {post.relateCount.toLocaleString()} people felt this.
        </p>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {snippet}
          {hasMore ? "…" : ""}
        </p>
        <p className="text-[11px] font-semibold text-primary pt-1">
          Read the full case →
        </p>
      </div>
    </button>
  );
}

function HofSurprisingCard({ post, onGate }: { post: HofSurprising; onGate: () => void }) {
  const purple = "oklch(0.68 0.18 295)";
  return (
    <button
      onClick={onGate}
      className="w-full text-left rounded-2xl bg-card overflow-hidden hover:bg-surface-elevated transition group"
      style={{ borderColor: purple, borderWidth: 0.5, borderStyle: "solid" }}
    >
      <div className="p-5 space-y-3">
        <HofLabel color={purple}>🌀 Most Surprising Outcome — All Time</HofLabel>
        <h3 className="text-lg sm:text-xl font-bold leading-tight text-balance">
          {post.title}
        </h3>
        <div className="rounded-xl bg-surface-elevated/60 p-4 space-y-2 text-sm">
          {post.dominantVerdict ? (
            <p>
              <span className="text-muted-foreground">The court predicted</span>{" "}
              <span className="font-semibold">{post.dominantVerdict}</span>
              {post.dominantPct > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {" "}
                  ({post.dominantPct}%)
                </span>
              )}
              <span className="text-muted-foreground">.</span>
            </p>
          ) : (
            <p className="text-muted-foreground">The court was split.</p>
          )}
          <p>
            <span className="text-muted-foreground">The outcome:</span>{" "}
            <span className="font-semibold" style={{ color: purple }}>
              {post.outcomeType}.
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {post.daysToOutcome} day{post.daysToOutcome === 1 ? "" : "s"} later
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          The court follows stories to their real endings.
        </p>
        <p className="text-[11px] font-semibold text-primary pt-1">
          Read the full case →
        </p>
      </div>
    </button>
  );
}

// ───────────────────────── Final CTA ─────────────────────────

function FinalCTA({ onGate }: { onGate: (intent: string) => void }) {
  const purple = "oklch(0.68 0.18 295)";
  return (
    <section
      className="rounded-3xl bg-surface-elevated p-8 text-center"
      style={{ borderColor: purple, borderWidth: 0.5, borderStyle: "solid" }}
    >
      <p className="text-2xl sm:text-3xl font-bold text-balance">
        The court is waiting for your judgment.
      </p>
      <p className="mt-3 text-sm text-muted-foreground text-balance">
        Anonymous identity. Real verdicts. Real outcomes.
      </p>
      <button
        onClick={() => onGate("claim_final")}
        className="mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm shadow-lg"
      >
        Claim my identity →
      </button>
    </section>
  );
}



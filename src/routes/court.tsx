import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTodaysCase,
  getMyStreak,
  recordParticipation,
  type DailyCase,
  type StreakInfo,
} from "@/lib/court.functions";
import {
  castVerdict,
  removeVerdict,
  getMyVerdict,
  getVerdictCounts,
  listComments,
  VERDICT_KINDS,
  type VerdictKind,
  type VerdictCounts,
  type CommentRow,
} from "@/lib/posts/community.functions";
import { toggleSavePost } from "@/lib/saved.functions";
import { CommentThread, type CommentThreadHandle } from "@/components/posts/CommentThread";

const VERDICT_LABELS: Record<VerdictKind, { emoji: string; label: string }> = {
  red_flag: { emoji: "🚩", label: "Red Flag" },
  green_flag: { emoji: "💚", label: "Green Flag" },
  run: { emoji: "🏃", label: "Run" },
  talk_it_out: { emoji: "🗣", label: "Talk It Out" },
  lawyer_up: { emoji: "⚖️", label: "Lawyer Up" },
  therapy_might_help: { emoji: "🛋", label: "Therapy Might Help" },
  need_update: { emoji: "👀", label: "Need Update" },
};

const empty = (): VerdictCounts =>
  VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);

export const Route = createFileRoute("/court")({
  component: CourtPage,
  head: () => ({
    meta: [
      { title: "⚖️ Daily Relationship Court™ — Shutap" },
      { name: "description", content: "Today's case. Who's actually wrong here? Vote, debate, decide." },
      { property: "og:title", content: "⚖️ Daily Relationship Court™" },
      { property: "og:description", content: "One case a day. The internet decides." },
      { property: "og:type", content: "website" },
    ],
  }),
});

function CourtPage() {
  const fetchCase = useServerFn(getTodaysCase);
  const [data, setData] = useState<DailyCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchCase();
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Court is closed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchCase]);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/75 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground">← Shutap</Link>
          <StreakChip />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-balance">⚖️ Daily Relationship Court™</h1>
          <p className="mt-2 text-base text-muted-foreground text-balance">
            Today's case… <span className="text-foreground font-medium">who's actually wrong here?</span>
          </p>
        </motion.div>

        {loading && <p className="text-center text-sm text-muted-foreground">Calling court to order…</p>}

        {!loading && !data?.post && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-base font-semibold">Court is in recess.</p>
            <p className="text-sm text-muted-foreground mt-1">No case has been filed yet. Be the first to publish your tea.</p>
            <Link
              to="/compose"
              className="inline-block mt-4 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm"
            >
              ✍️ File a case
            </Link>
          </div>
        )}

        {!loading && data?.post && <CaseBlock data={data} />}
      </main>
    </div>
  );
}

function CaseBlock({ data }: { data: DailyCase }) {
  const post = data.post!;
  const commentsRef = useRef<CommentThreadHandle | null>(null);

  return (
    <>
      <article className="rounded-2xl border border-border bg-card overflow-hidden">
        {post.mediaUrl && (
          <div className="aspect-video bg-surface-elevated overflow-hidden">
            <img src={post.mediaUrl} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            {post.scoreCategory && (
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold uppercase tracking-wide">
                {post.scoreCategory}
              </span>
            )}
            {post.score != null && (
              <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border">🔥 {post.score}</span>
            )}
            {post.badges.slice(0, 3).map((b) => (
              <span key={b} className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border">{b}</span>
            ))}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-balance">{post.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{post.storyText}</p>
          <div className="flex items-center justify-between gap-3 pt-2 text-[11px] text-muted-foreground">
            <span>💬 {post.commentCount} · ❤️ {post.likeCount} · 📤 {post.shareCount}</span>
            <CaseToolbar postId={post.id} title={post.title} />
          </div>
        </div>
      </article>

      <CourtVerdict
        postId={post.id}
        initialCounts={data.verdict.counts}
        initialTotal={data.verdict.total}
        aiSummary={data.aiSummary ?? ""}
        onParticipated={() => commentsRef.current?.focus("Honestly… here's my ruling: ")}
      />

      <HotComments postId={post.id} />

      <CommentThread
        ref={commentsRef}
        postId={post.id}
        onCommentPosted={() => { /* streak handled inside CourtVerdict for vote; comment bumps here */ void bumpStreakSafe(); }}
      />
    </>
  );
}

async function bumpStreakSafe() {
  try {
    const fn = recordParticipation;
    // Need bearer; call via fetch through serverFn helper:
    await (fn as unknown as (args: { data: Record<string, never> }) => Promise<unknown>)({ data: {} });
  } catch { /* ignore */ }
}

function CaseToolbar({ postId, title }: { postId: string; title: string }) {
  const save = useServerFn(toggleSavePost);
  const [saved, setSaved] = useState(false);
  const onSave = async () => {
    const prev = saved;
    setSaved(!prev);
    try {
      const r = await save({ data: { postId } });
      setSaved(r.saved);
    } catch (e) {
      setSaved(prev);
      toast.error(e instanceof Error ? e.message : "Sign in to bookmark");
    }
  };
  const onShare = async () => {
    const url = `${window.location.origin}/post/${postId}?ref=court`;
    if (navigator.share) {
      try { await navigator.share({ title, url, text: `Daily Relationship Court™: ${title}` }); return; }
      catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };
  return (
    <div className="flex gap-2">
      <button onClick={onShare} className="px-2.5 py-1 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition">
        📤 Share
      </button>
      <button onClick={onSave} className={`px-2.5 py-1 rounded-full border transition ${saved ? "bg-primary text-primary-foreground border-primary" : "bg-surface-elevated border-border hover:border-primary/50"}`}>
        {saved ? "🔖 Saved" : "🔖 Save"}
      </button>
      <Link to="/post/$postId" params={{ postId }} className="px-2.5 py-1 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition">
        Open →
      </Link>
    </div>
  );
}

function CourtVerdict({
  postId,
  initialCounts,
  initialTotal,
  aiSummary,
  onParticipated,
}: {
  postId: string;
  initialCounts: VerdictCounts;
  initialTotal: number;
  aiSummary: string;
  onParticipated?: () => void;
}) {
  const cast = useServerFn(castVerdict);
  const remove = useServerFn(removeVerdict);
  const getMine = useServerFn(getMyVerdict);
  const refetchCounts = useServerFn(getVerdictCounts);
  const bumpStreak = useServerFn(recordParticipation);

  const [counts, setCounts] = useState<VerdictCounts>(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [mine, setMine] = useState<VerdictKind | null>(null);
  const [authed, setAuthed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthed(!!u.user);
      if (u.user) {
        try {
          const m = await getMine({ data: { postId } });
          if (!cancelled && m.kind) { setMine(m.kind); setRevealed(true); }
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [postId, getMine]);

  const onVote = async (kind: VerdictKind) => {
    if (!authed) { toast.message("Sign in to vote"); return; }
    const prev = mine;
    setCounts((c) => {
      const next = { ...c };
      if (prev && prev !== kind) next[prev] = Math.max(0, next[prev] - 1);
      next[kind] = (next[kind] ?? 0) + (prev === kind ? -1 : 1);
      if (next[kind] < 0) next[kind] = 0;
      return next;
    });
    setTotal((t) => (prev === kind ? Math.max(0, t - 1) : prev ? t : t + 1));
    const nextMine = prev === kind ? null : kind;
    setMine(nextMine);
    try {
      if (prev === kind) await remove({ data: { postId } });
      else await cast({ data: { postId, kind } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
      try {
        const r = await refetchCounts({ data: { postId } });
        setCounts(r.counts); setTotal(r.total);
      } catch { /* ignore */ }
      return;
    }
    if (nextMine) {
      setRevealed(true);
      try { await bumpStreak({ data: {} }); } catch { /* ignore */ }
      onParticipated?.();
    }
  };

  const sorted = (Object.entries(counts) as Array<[VerdictKind, number]>)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-bold">🧑‍⚖️ Cast your verdict</h3>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? "juror" : "jurors"}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VERDICT_KINDS.map((k) => {
          const active = mine === k;
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.96 }}
              onClick={() => onVote(k)}
              className={`px-3 py-2.5 rounded-xl text-sm border transition text-left ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-elevated border-border hover:border-primary/60"
              }`}
            >
              <span className="block text-lg leading-none">{VERDICT_LABELS[k].emoji}</span>
              <span className="block mt-1 text-xs font-semibold">{VERDICT_LABELS[k].label}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">How the world voted</p>
              <ul className="space-y-1.5">
                {sorted.map(([k, n]) => {
                  const pct = total === 0 ? 0 : Math.round((n / total) * 100);
                  return (
                    <li key={k} className="relative overflow-hidden rounded-full border border-border bg-surface-elevated">
                      <span className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${pct}%` }} />
                      <span className="relative flex items-center justify-between px-3 py-1.5 text-xs">
                        <span>{VERDICT_LABELS[k].emoji} {VERDICT_LABELS[k].label}</span>
                        <span className="tabular-nums font-semibold">{pct}%</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 to-accent/10 p-3">
              <p className="text-sm font-semibold">{aiSummary || "The internet has spoken 😭"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HotComments({ postId }: { postId: string }) {
  const fetchComments = useServerFn(listComments);
  const [items, setItems] = useState<CommentRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchComments({ data: { postId, sort: "top", limit: 3 } });
        if (!cancelled) setItems(list.slice(0, 3));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [postId, fetchComments]);
  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold mb-3">🔥 Hot opinions from the jury</p>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold">{c.author?.nickname ?? c.author?.handle ?? "anon"}</span>
              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">❤️ {c.likeCount} · 😂 {c.funnyCount}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StreakChip() {
  const fetch = useServerFn(getMyStreak);
  const [s, setS] = useState<StreakInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user || cancelled) return;
        const r = await fetch({ data: {} });
        if (!cancelled) setS(r);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetch]);
  if (!s || s.current === 0) {
    return <span className="text-[11px] text-muted-foreground">Vote daily → build a streak</span>;
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-xs font-semibold">
      <span>{s.badge?.emoji ?? "🔥"}</span>
      <span>{s.current}-day {s.badge?.label ?? "streak"}</span>
    </div>
  );
}

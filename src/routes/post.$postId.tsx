import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { ScoreCard } from "@/components/post-engine/ScoreCard";
import { getPublishedPost, getPostReactionCounts } from "@/lib/posts/public.functions";
import { recordShare, reactToPost } from "@/lib/posts/engagement.functions";
import { recordPostView } from "@/lib/post-analytics.functions";
import { toggleSavePost } from "@/lib/saved.functions";
import { buildShareIntent } from "@/lib/share/platforms";
import { nativeShareCard, downloadShareCard, canNativeShare } from "@/lib/share/native-share";
import { supabase } from "@/integrations/supabase/client";
import { VerdictBar } from "@/components/posts/VerdictBar";
import { CommentThread, type CommentThreadHandle } from "@/components/posts/CommentThread";
import { RelatedPosts } from "@/components/posts/RelatedPosts";
import { StoryArc } from "@/components/posts/StoryArc";
import { OtherPerspectives } from "@/components/perspectives/OtherPerspectives";
import { PredictionsPanel } from "@/components/court/PredictionsPanel";
import { OutcomePrompt } from "@/components/court/OutcomePrompt";
import { WisdomGraphPanel } from "@/components/court/WisdomGraphPanel";
import { StoryAliasBlock } from "@/components/posts/StoryAliasBlock";
import { JudgmentButtons } from "@/components/posts/JudgmentButtons";
import { SteelmanCard } from "@/components/posts/SteelmanCard";
import { DevilsAdvocateToggle } from "@/components/posts/DevilsAdvocateToggle";
import { CaseSummaryToggle } from "@/components/posts/CaseSummaryToggle";
import { SpillScanCTA } from "@/components/posts/SpillScanCTA";
import { AuthorMenu } from "@/components/posts/AuthorMenu";
import { ServiceCard } from "@/components/posts/ServiceCard";
import { FinalVerdictScreen } from "@/components/posts/FinalVerdictScreen";

import { RelateButton } from "@/components/stream/RelateButton";
import { useSoftGate } from "@/components/stream/useSoftGate";
import type { PostRecord, ReactionKind, SharePlatform } from "@/lib/posts/types";


export const Route = createFileRoute("/post/$postId")({
  loader: async ({ params }) => {
    const { post } = await getPublishedPost({ data: { postId: params.postId } });
    // Best-effort: surface the active court case so head() can wire a Bench-themed OG image.
    let caseId: string | null = null;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("court_cases")
        .select("id")
        .eq("post_id", params.postId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      caseId = (data as any)?.id ?? null;
    } catch {
      /* fall through to the standard share-card image */
    }
    return { post, caseId };
  },
  validateSearch: (s: Record<string, unknown>) => ({ shared: Number(s.shared ?? 2) }),
  component: PostPageShell,
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Shutap" }] };
    const caseId = loaderData?.caseId;
    const ogImage = caseId
      ? `/api/public/og/case/${caseId}`
      : (p.share_card_square ?? `/api/public/share-card/${params.postId}?format=square`);
    return {
      meta: [
        { title: `${p.title} — Shutap` },
        { name: "description", content: p.story_text.slice(0, 160) },
        { property: "og:title", content: p.title },
        { property: "og:description", content: p.story_text.slice(0, 200) },
        { property: "og:type", content: "article" },
        { property: "og:image", content: ogImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <p className="text-2xl font-medium">404</p>
        <Link to="/" className="text-primary underline mt-2 inline-block">Go home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function PostPageShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  return (
    <I18nProvider locale={locale}>
      <PostPage />
    </I18nProvider>
  );
}

function PostPage() {
  const { t } = useT();
  const { post } = Route.useLoaderData();
  const { shared } = Route.useSearch();
  // shared === 1 means "just published, celebrate + nudge to share"
  // shared === 2 (default) means "ordinary view, no auto-popup"
  const justPublished = shared === 1;
  const [showShare, setShowShare] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [readDepth, setReadDepth] = useState(0);
  const [devilsAdvocate, setDevilsAdvocate] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [finalVerdict, setFinalVerdict] = useState<null | {
    caseId: string; tier: string | null; regionLabel: string | null;
    finalVerdict: string | null; benchVerdictLine: string | null;
    total: number; dominantPct: number;
  }>(null);
  const [verdictDismissed, setVerdictDismissed] = useState(false);
  const commentsRef = useRef<CommentThreadHandle | null>(null);

  const recordView = useServerFn(recordPostView);
  const react = useServerFn(reactToPost);
  const softGate = useSoftGate();

  // Identify viewer (for author-only menu).
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setViewerId(data.user?.id ?? null);
      } catch { /* ignore */ }
    })();
  }, []);

  // Scroll-depth tracking — weights the user's verdict by how much they read.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (max <= 0) { setReadDepth(100); return; }
      const pct = Math.min(100, Math.max(0, Math.round((h.scrollTop / max) * 100)));
      setReadDepth((prev) => (pct > prev ? pct : prev));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fire-and-forget view tracking (deduped per session via sessionStorage + 24h DB dedupe).
  useEffect(() => {
    if (!post) return;
    const key = `mv:${post.id}`;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    let sid = localStorage.getItem("md.sid");
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
      localStorage.setItem("md.sid", sid);
    }
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        await recordView({ data: { postId: post.id, sessionId: sid!, viewerId: u.user?.id ?? null } });
      } catch { /* ignore */ }
    })();
  }, [post, recordView]);

  // Author-only: surface the FinalVerdictScreen once per decided case.
  useEffect(() => {
    if (!post || !viewerId || viewerId !== (post as any).author_id) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const { data: cc } = await supabase
        .from("court_cases")
        .select("id, current_tier, region_label, final_verdict, bench_verdict_line, status")
        .eq("post_id", post.id)
        .in("status", ["decided", "legendary"])
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !cc) return;
      const seenKey = `mv:fv:${(cc as any).id}`;
      if (localStorage.getItem(seenKey)) return;
      // tally
      const { data: votes } = await supabase
        .from("post_verdict_votes")
        .select("kind")
        .eq("post_id", post.id);
      const tally: Record<string, number> = {};
      for (const v of (votes ?? []) as Array<{ kind: string }>) tally[v.kind] = (tally[v.kind] ?? 0) + 1;
      const total = (votes ?? []).length;
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      const pct = top && total > 0 ? Math.round((top[1] / total) * 100) : 0;
      if (cancelled) return;
      setFinalVerdict({
        caseId: (cc as any).id,
        tier: (cc as any).current_tier ?? null,
        regionLabel: (cc as any).region_label ?? null,
        finalVerdict: (cc as any).final_verdict ?? top?.[0] ?? null,
        benchVerdictLine: (cc as any).bench_verdict_line ?? null,
        total,
        dominantPct: pct,
      });
    })();
    return () => { cancelled = true; };
  }, [post, viewerId]);


  if (!post) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-xl font-medium mb-2">{t("post.notFound")}</p>
          <Link to="/" className="text-primary underline">←</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain pb-24">
      <header className="sticky top-0 z-30  bg-background/75 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/" className="text-sm text-muted-foreground">← {t("appName")}</Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShare(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium"
            >
              Share
            </button>
            {viewerId && viewerId === post.author_id && <AuthorMenu postId={post.id} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {(post as any).case_closed_at && (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-500">
            ⚖️ Case closed — the author marked this resolved.
          </div>
        )}
        {(post as any).sequel_of && (
          <Link
            to="/post/$postId"
            params={{ postId: (post as any).sequel_of }}
            className="block rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
          >
            ← Read the original case
          </Link>
        )}
        {(post as any).case_closed_of && (
          <Link
            to="/post/$postId"
            params={{ postId: (post as any).case_closed_of }}
            className="block rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
          >
            ← Open original case
          </Link>
        )}
        {justPublished && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/40 bg-primary p-4 flex items-center gap-3"
          >
            <span className="text-2xl">🎉</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Your tea is live</p>
              <p className="text-xs text-muted-foreground">it's on the leaderboard. now make a friend cry-laugh 👇</p>
            </div>
            <button
              onClick={() => setShowShare(true)}
              className="shrink-0 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              Share
            </button>
          </motion.div>
        )}

        {/* Alias + side-of-story */}
        <StoryAliasBlock
          emoji={(post as any).author_emoji}
          nationality={(post as any).author_nationality}
          emotion={(post as any).author_emotion}
          creature={(post as any).author_creature}
          bothSidesHeard={(post as any).both_sides_heard}
        />

        <ScoreCard
          score={post.score ?? 0}
          category={post.score_category ?? ""}
          title={post.title}
          badges={post.badges}
          mediaUrl={post.media_url}
        />

        {/* Case title + question-before-court (graceful when columns absent) */}
        {(post as any).case_title && (
          <h2 className="text-lg font-medium leading-snug">{(post as any).case_title}</h2>
        )}
        {(post as any).question_before_court && (
          <p className="italic text-base leading-relaxed" style={{ color: "var(--c-text-2)" }}>
            “{(post as any).question_before_court}”
          </p>
        )}

        <p className="text-lg leading-relaxed text-balance">{post.story_text}</p>

        <CaseSummaryToggle summary={(post as any).case_summary ?? null} />

        <VerdictBar
          postId={post.id}
          relationshipType={(post as any).relationship_type ?? null}
          readDepthPercent={readDepth}
          devilsAdvocate={devilsAdvocate}
          onVoted={() => {
            setHasVoted(true);
            commentsRef.current?.focus("Honestly… here's what I'd do: ");
          }}
        />

        <JudgmentButtons onCast={() => setHasVoted(true)} />

        <div className="flex items-center justify-between gap-3 px-1">
          <RelateButton
            count={(post as any).relate_count ?? 0}
            onActivate={async () => {
              if (!viewerId) { softGate("relate", { entityId: post.id }); return; }
              try { await react({ data: { postId: post.id, kind: "been_there" } }); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't record"); }
            }}
          />
        </div>

        <DevilsAdvocateToggle active={devilsAdvocate} onToggle={setDevilsAdvocate} />

        <SteelmanCard
          hasSteelman={(post as any).has_steelman}
          body={(post as any).steelman_body ?? null}
        />

        {hasVoted && <SpillScanCTA />}

        <ReactionsBar postId={post.id} />
        <div className="pt-2 grid grid-cols-3 gap-3">
          <button
            onClick={() => setShowShare(true)}
            className="col-span-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium"
          >
            📤 Challenge a friend
          </button>
          <SaveButton postId={post.id} />
        </div>
        <Link
          to="/"
          className="block px-6 py-3 rounded-full bg-surface-elevated border border-border font-medium text-center"
        >
          {t("post.landingCta")}
        </Link>
        <StoryArc postId={post.id} />
        <PredictionsPanel postId={post.id} />
        <OutcomePrompt postId={post.id} authorId={post.author_id} />
        <WisdomGraphPanel postId={post.id} />
        <OtherPerspectives postId={post.id} plaintiffId={post.author_id} />
        <CommentThread
          ref={commentsRef}
          postId={post.id}
          postAuthorId={post.author_id}
          onCommentPosted={() => setShowRelated(true)}
        />
        <RelatedPosts postId={post.id} autoLoad={showRelated} />

        <ServiceCard tags={(post as any).tags ?? null} />
      </main>


      <AnimatePresence>
        {showShare && <SharePopup post={post} onClose={() => setShowShare(false)} />}
      </AnimatePresence>

      {finalVerdict && !verdictDismissed && (
        <FinalVerdictScreen
          caseId={finalVerdict.caseId}
          postId={post.id}
          tier={finalVerdict.tier}
          regionLabel={finalVerdict.regionLabel}
          caseTitle={(post as any).case_title || post.title}
          finalVerdict={finalVerdict.finalVerdict}
          benchVerdictLine={finalVerdict.benchVerdictLine}
          total={finalVerdict.total}
          dominantPct={finalVerdict.dominantPct}
          alias={null}
          onClose={() => {
            try { localStorage.setItem(`mv:fv:${finalVerdict.caseId}`, "1"); } catch { /* ignore */ }
            setVerdictDismissed(true);
          }}
        />
      )}
    </div>
  );
}


function ReactionsBar({ postId }: { postId: string }) {
  const { t } = useT();
  const getCounts = useServerFn(getPostReactionCounts);
  const react = useServerFn(reactToPost);
  const [counts, setCounts] = useState<Record<ReactionKind, number>>({
    been_there: 0, worse: 0, hug: 0, laugh: 0, drama: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await getCounts({ data: { postId } });
        if (!cancelled) setCounts(r.counts);
      } catch { /* ignore */ }
    };
    void tick();
    const id = setInterval(tick, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [getCounts, postId]);

  const onReact = async (kind: ReactionKind) => {
    setCounts((c) => ({ ...c, [kind]: c[kind] + 1 }));
    try {
      await react({ data: { postId, kind } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't react");
      setCounts((c) => ({ ...c, [kind]: Math.max(0, c[kind] - 1) }));
    }
  };

  const KINDS: ReactionKind[] = ["been_there", "worse", "hug", "laugh", "drama"];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium mb-3">{t("post.reactions.title")}</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => onReact(k)}
            className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs hover:border-primary/50 transition"
          >
            {t(`post.reactions.kinds.${k}` as const)} · {counts[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveButton({ postId }: { postId: string }) {
  const toggle = useServerFn(toggleSavePost);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const prev = saved;
    setSaved(!prev);
    try {
      const r = await toggle({ data: { postId } });
      setSaved(r.saved);
    } catch (e) {
      setSaved(prev);
      toast.error(e instanceof Error ? e.message : "Sign in to save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-4 py-3 rounded-full font-medium border transition ${
        saved
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-surface-elevated border-border hover:border-primary/60"
      }`}
    >
      {saved ? "🔖 Saved" : "🔖 Save"}
    </button>
  );
}

function SharePopup({ post, onClose }: { post: PostRecord; onClose: () => void }) {
  const { t } = useT();
  const recordSh = useServerFn(recordShare);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://shutap.lovable.app";
  const postUrl = `${origin}/s/${post.id}?ref=native`;
  const [busy, setBusy] = useState<"idle" | "native" | "download">("idle");
  const [nativeReady, setNativeReady] = useState(false);
  useEffect(() => setNativeReady(canNativeShare()), []);

  const PLATFORMS: SharePlatform[] = [
    "x", "tiktok", "instagram", "xiaohongshu", "facebook", "imessage", "whatsapp", "copy_link",
  ];
  const EMOJI: Record<SharePlatform, string> = {
    x: "𝕏", tiktok: "🎵", instagram: "📷", xiaohongshu: "📕",
    facebook: "📘", imessage: "💬", whatsapp: "💚", copy_link: "🔗",
  };

  const onNativeShare = async () => {
    if (busy !== "idle") return;
    setBusy("native");
    const shareText = post.platform_captions?.x ?? post.title;
    const result = await nativeShareCard({
      postId: post.id,
      title: post.title,
      text: `${shareText}\n\n${t("post.share.cta")}`,
      url: postUrl,
    });
    setBusy("idle");
    if (result.ok) {
      try { await recordSh({ data: { postId: post.id, platform: "copy_link" } }); } catch { /* ignore */ }
      toast.success(t("post.share.done"));
    } else if (result.reason === "unsupported") {
      toast.message(t("post.share.nativeFallback"));
    } else if (result.reason === "error") {
      toast.error(result.error instanceof Error ? result.error.message : "Share failed");
    }
  };

  const onDownload = async () => {
    if (busy !== "idle") return;
    setBusy("download");
    try {
      await downloadShareCard(post.id, "square");
      toast.success(t("post.share.downloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy("idle");
    }
  };

  const onPick = async (p: SharePlatform) => {
    const intent = buildShareIntent(p, {
      postId: post.id,
      origin,
      title: post.title,
      score: post.score ?? 0,
      captions: post.platform_captions,
      shareImage: post.share_card_square,
      ctaText: t("post.share.cta"),
    });
    try { await recordSh({ data: { postId: post.id, platform: p } }); } catch { /* ignore */ }
    if (intent.kind === "url") {
      window.open(intent.url, "_blank", "noopener,noreferrer");
    } else if (intent.kind === "copy") {
      await navigator.clipboard.writeText(intent.caption);
      toast.success(t(`post.share.${intent.toast}` as const));
    } else {
      await navigator.clipboard.writeText(intent.caption);
      toast.success(t("post.share.captionCopied"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95  overflow-y-auto"
    >
      <div className="mx-auto max-w-md px-6 py-8 min-h-full flex flex-col">
        <motion.h2
          initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-2xl sm:text-3xl font-medium text-center text-balance"
        >
          👀 Be honest…
        </motion.h2>
        <p className="mt-2 text-center text-base text-balance">
          Is your friend's relationship messier? <span className="text-muted-foreground">Send this and find out.</span>
        </p>

        <div className="mt-6 max-w-[280px] mx-auto w-full">
          <ScoreCard
            score={post.score ?? 0}
            category={post.score_category ?? ""}
            title={post.title}
            badges={post.badges}
            mediaUrl={post.media_url}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {nativeReady && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onNativeShare}
              disabled={busy !== "idle"}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium text-sm  disabled:opacity-60"
            >
              {busy === "native" ? t("post.share.nativePreparing") : `📤 ${t("post.share.native")}`}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onDownload}
            disabled={busy !== "idle"}
            className="w-full py-3 rounded-full bg-surface-elevated border border-border font-medium text-sm disabled:opacity-60"
          >
            {busy === "download" ? t("post.share.nativePreparing") : `⬇ ${t("post.share.downloadCard")}`}
          </motion.button>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-3">
          {PLATFORMS.map((p) => (
            <motion.button
              key={p}
              whileTap={{ scale: 0.92 }}
              onClick={() => onPick(p)}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface-elevated border border-border hover:border-primary/60 transition"
            >
              <span className="text-2xl">{EMOJI[p]}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {t(`post.share.platforms.${p}` as const)}
              </span>
            </motion.button>
          ))}
        </div>

        <button onClick={onClose} className="mt-auto pt-8 text-sm text-muted-foreground">
          {t("post.share.close")}
        </button>
      </div>
    </motion.div>
  );
}

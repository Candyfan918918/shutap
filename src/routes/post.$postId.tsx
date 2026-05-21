import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { ScoreCard } from "@/components/post-engine/ScoreCard";
import { getPublishedPost, getPostReactionCounts } from "@/lib/posts/public.functions";
import { recordShare, reactToPost } from "@/lib/posts/engagement.functions";
import { recordPostView } from "@/lib/post-analytics.functions";
import { buildShareIntent } from "@/lib/share/platforms";
import { nativeShareCard, downloadShareCard, canNativeShare } from "@/lib/share/native-share";
import { supabase } from "@/integrations/supabase/client";
import type { PostRecord, ReactionKind, SharePlatform } from "@/lib/posts/types";

export const Route = createFileRoute("/post/$postId")({
  loader: async ({ params }) => {
    const { post } = await getPublishedPost({ data: { postId: params.postId } });
    return { post };
  },
  validateSearch: (s: Record<string, unknown>) => ({ shared: Number(s.shared ?? 2) }),
  component: PostPageShell,
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Shutap" }] };
    const ogImage = p.share_card_square ?? `/api/public/share-card/${params.postId}?format=square`;
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
        <p className="text-2xl font-bold">404</p>
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
  const recordView = useServerFn(recordPostView);

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

  if (!post) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-xl font-semibold mb-2">{t("post.notFound")}</p>
          <Link to="/" className="text-primary underline">←</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/75 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground">← {t("appName")}</Link>
          <button
            onClick={() => setShowShare(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold"
          >
            Share
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {justPublished && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 to-accent/15 p-4 flex items-center gap-3"
          >
            <span className="text-2xl">🎉</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Your tea is live</p>
              <p className="text-xs text-muted-foreground">it's on the leaderboard. now make a friend cry-laugh 👇</p>
            </div>
            <button
              onClick={() => setShowShare(true)}
              className="shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold"
            >
              Share
            </button>
          </motion.div>
        )}
        <ScoreCard
          score={post.score ?? 0}
          category={post.score_category ?? ""}
          title={post.title}
          badges={post.badges}
          mediaUrl={post.media_url}
        />
        <p className="text-lg leading-relaxed text-balance">{post.story_text}</p>
        <ReactionsBar postId={post.id} />
        <div className="pt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowShare(true)}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
          >
            📤 Challenge a friend
          </button>
          <Link
            to="/"
            className="px-6 py-3 rounded-full bg-surface-elevated border border-border font-semibold text-center"
          >
            {t("post.landingCta")}
          </Link>
        </div>
      </main>

      <AnimatePresence>
        {showShare && <SharePopup post={post} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
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
      <p className="text-sm font-semibold mb-3">{t("post.reactions.title")}</p>
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
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="mx-auto max-w-md px-6 py-8 min-h-full flex flex-col">
        <motion.h2
          initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-2xl sm:text-3xl font-bold text-center text-balance"
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
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm shadow-lg disabled:opacity-60"
            >
              {busy === "native" ? t("post.share.nativePreparing") : `📤 ${t("post.share.native")}`}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onDownload}
            disabled={busy !== "idle"}
            className="w-full py-3 rounded-full bg-surface-elevated border border-border font-semibold text-sm disabled:opacity-60"
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

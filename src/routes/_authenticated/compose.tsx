import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { ScoreCard } from "@/components/post-engine/ScoreCard";
import {
  generateStoryDraft,
  createDraftPost,
  updateDraftPost,
  approveAndPublish,
} from "@/lib/posts/drafts.functions";
import { linkScanToPost } from "@/lib/scan.functions";
import { scoreCategoryLabel, type DraftPayload, type PostTone } from "@/lib/posts/types";
import { scanPii, type PiiHit } from "@/lib/pii";
import { AnimatePresence } from "framer-motion";
import {
  BlockedContentInterstitial,
  parseSafetyBlock,
  type BlockedReason,
} from "@/lib/safety/blocked-content";


export const Route = createFileRoute("/_authenticated/compose")({
  component: ComposeShell,
  validateSearch: (s: Record<string, unknown>) => ({
    score: Number(s.score ?? 742),
    scanId: typeof s.scanId === "string" ? s.scanId : undefined,
  }),
  head: () => ({ meta: [{ title: "Compose your Shutap post" }] }),
});

function ComposeShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  return (
    <I18nProvider locale={locale}>
      <Composer />
    </I18nProvider>
  );
}

function Composer() {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const { score, scanId } = Route.useSearch();
  const category = scoreCategoryLabel(score);

  const genDraft = useServerFn(generateStoryDraft);
  const createDraft = useServerFn(createDraftPost);
  const updateDraft = useServerFn(updateDraftPost);
  const publish = useServerFn(approveAndPublish);
  const linkScan = useServerFn(linkScanToPost);

  const [tone, setTone] = useState<PostTone>("funny");
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [piiHits, setPiiHits] = useState<PiiHit[] | null>(null);
  const [blocked, setBlocked] = useState<BlockedReason | null>(null);


  // Generate initial draft + persist
  const regen = async (nextTone: PostTone = tone) => {
    setLoading(true);
    try {
      const d = await genDraft({
        data: {
          scoreContext: { score, category, locale, tags: [] },
          tone: nextTone,
          seed: Math.floor(Math.random() * 1e6),
        },
      });
      setDraft(d);
      if (postId) {
        await updateDraft({
          data: {
            postId,
            patch: {
              title: d.title,
              story_text: d.story,
              tone: nextTone,
              badges: d.badges,
              hashtags: d.hashtags,
              platform_captions: d.platform_captions as Record<string, string>,
            },
          },
        });
      } else {
        const { post } = await createDraft({
          data: { draft: d, tone: nextTone, locale, score, scoreCategory: category },
        });
        setPostId(post.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void regen("funny");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTone = (next: PostTone) => {
    setTone(next);
    void regen(next);
  };

  const doPublish = async () => {
    if (!postId || !draft) return;
    setPiiHits(null);
    setPublishing(true);
    try {
      await updateDraft({
        data: {
          postId,
          patch: { title: draft.title, story_text: draft.story },
        },
      });
      await publish({ data: { postId } });
      if (scanId) {
        try {
          await linkScan({ data: { scanId, postId } });
        } catch {
          /* non-fatal — the post is published either way */
        }
      }
      navigate({ to: "/post/$postId", params: { postId }, search: { shared: 0 } });
    } catch (e) {
      const block = parseSafetyBlock(e);
      if (block) {
        // Public post row was already soft-deleted server-side; clear local postId
        // so an Edit click starts a fresh draft with the existing text restored below.
        setPostId(null);
        setBlocked(block);
      } else {
        toast.error(e instanceof Error ? e.message : "Publish failed");
      }
    } finally {
      setPublishing(false);
    }

  };

  const onApprove = () => {
    if (!postId || !draft) return;
    const combined = `${draft.title}\n${draft.story}`;
    const hits = scanPii(combined);
    if (hits.length > 0) {
      setPiiHits(hits);
      return;
    }
    void doPublish();
  };

  const TONES: PostTone[] = ["funny", "serious", "chaotic", "soft"];

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <BlockedContentInterstitial
        open={!!blocked}
        onEdit={() => setBlocked(null)}
      />

      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate({ to: "/" })} className="text-sm text-muted-foreground">
            {t("post.backToScore")}
          </button>
          <span className="font-semibold">{t("post.composer.title")}</span>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <p className="text-sm text-muted-foreground text-center">{t("post.composer.sub")}</p>

        {loading || !draft ? (
          <div className="aspect-[4/5] rounded-3xl bg-surface-elevated animate-pulse grid place-items-center">
            <span className="text-sm text-muted-foreground">{t("post.drafting")}</span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <ScoreCard
              score={score}
              category={category}
              title={draft.title}
              badges={draft.badges}
            />
          </motion.div>
        )}

        {draft && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                {t("post.titleLabel")}
              </label>
              <textarea
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                rows={2}
                className="mt-1 w-full bg-surface-elevated border border-border rounded-xl p-3 text-base resize-none focus:outline-none focus:border-primary/50"
                maxLength={160}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                {t("post.storyLabel")}
              </label>
              <textarea
                value={draft.story}
                onChange={(e) => setDraft({ ...draft, story: e.target.value })}
                rows={4}
                className="mt-1 w-full bg-surface-elevated border border-border rounded-xl p-3 text-base resize-none focus:outline-none focus:border-primary/50"
                maxLength={600}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                {t("post.toneLabel")}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TONES.map((tk) => (
                  <button
                    key={tk}
                    onClick={() => onTone(tk)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-full border text-sm transition ${
                      tone === tk
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-surface-elevated text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {t(`post.tones.${tk}` as const)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex gap-2">
          <button
            onClick={() => regen(tone)}
            disabled={loading || publishing}
            className="flex-1 px-4 py-3 rounded-full bg-surface-elevated border border-border text-sm font-medium disabled:opacity-50"
          >
            🔄 {t("post.regenerate")}
          </button>
          <button
            onClick={onApprove}
            disabled={loading || publishing || !draft}
            className="flex-[2] px-4 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {publishing ? t("post.publishing") : `✨ ${t("post.approve")}`}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {piiHits && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <p className="text-2xl">🚨</p>
              <h3 className="mt-2 text-lg font-bold">Hold up — looks like personal info</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We spotted what looks like contact details. Posts on Shutap are anonymous —
                please remove names, phone numbers, emails, handles, and links before publishing.
              </p>
              <ul className="mt-3 space-y-1 max-h-40 overflow-auto">
                {piiHits.map((h, i) => (
                  <li key={i} className="text-xs flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold uppercase tracking-wider text-[10px]">
                      {h.kind}
                    </span>
                    <code className="truncate">{h.sample}</code>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setPiiHits(null)}
                  className="flex-1 px-4 py-2.5 rounded-full bg-surface-elevated border border-border text-sm font-medium"
                >
                  ← Let me edit
                </button>
                <button
                  onClick={() => void doPublish()}
                  className="flex-1 px-4 py-2.5 rounded-full bg-destructive text-destructive-foreground text-sm font-bold"
                >
                  Publish anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

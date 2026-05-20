import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getTeaDraft, generateThreeTones, selectVariant, publishTea } from "@/lib/spill.functions";
import { ReceiptsUploader } from "@/components/spill/ReceiptsUploader";
import { supabase } from "@/integrations/supabase/client";
import type { SpillDraftRow, ToneVariant } from "@/lib/spill/types";

const TONE_META: Record<ToneVariant["tone"], { label: string; emoji: string; sub: string }> = {
  funny: { label: "Funny", emoji: "😂", sub: "tiktok meme energy" },
  honest: { label: "Honest", emoji: "🥺", sub: "the 2am whisper version" },
  petty: { label: "Extra Petty", emoji: "💅", sub: "group chat unhinged" },
};

export const Route = createFileRoute("/_authenticated/spill/$draftId/draft")({
  component: DraftPage,
  head: () => ({ meta: [{ title: "Pick your version" }] }),
});

function DraftPage() {
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getTeaDraft);
  const generate = useServerFn(generateThreeTones);
  const select = useServerFn(selectVariant);
  const publish = useServerFn(publishTea);

  const [draft, setDraft] = useState<SpillDraftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<ToneVariant["tone"]>("funny");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingStory, setEditingStory] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then((r) => setUserId(r.data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { draft: row } = await load({ data: { draftId } });
        if (cancelled) return;
        let working = row;
        if (!working.draft_variants || working.draft_variants.length < 3) {
          const { draft: gen } = await generate({ data: { draftId } });
          working = gen;
        }
        if (cancelled) return;
        setDraft(working);
        const firstMedia = (working.media ?? []).find((m) => m.kind === "image" || m.kind === "video");
        setCoverUrl(working.cover_url ?? firstMedia?.url ?? null);
        const initial = working.draft_variants?.[0];
        if (initial) {
          setPicked(initial.tone);
          setEditingTitle(initial.title);
          setEditingStory(initial.story);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Drafts failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const onPick = (tone: ToneVariant["tone"]) => {
    setPicked(tone);
    const v = draft?.draft_variants?.find((x) => x.tone === tone);
    if (v) {
      setEditingTitle(v.title);
      setEditingStory(v.story);
    }
  };

  const onPublish = async () => {
    if (!draft || publishing) return;
    setPublishing(true);
    try {
      await select({
        data: {
          draftId,
          tone: picked,
          title: editingTitle.trim(),
          story: editingStory.trim(),
          coverUrl,
        },
      });
      const { postId } = await publish({ data: { draftId } });
      navigate({ to: "/post/$postId", params: { postId }, search: { shared: 1 } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
      setPublishing(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Cooking up 3 versions…
      </div>
    );
  }

  const variants = draft.draft_variants ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-40">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <button onClick={() => history.back()} className="text-sm text-muted-foreground">← Back</button>
          <span className="text-xs font-semibold tracking-widest text-primary">PICK A VIBE</span>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-muted-foreground"
        >
          okay… I turned your chaos into a post 👀
        </motion.p>

        {/* Tone tabs */}
        <div className="grid grid-cols-3 gap-2">
          {variants.map((v) => {
            const meta = TONE_META[v.tone];
            const on = picked === v.tone;
            return (
              <button
                key={v.tone}
                onClick={() => onPick(v.tone)}
                className={`p-3 rounded-2xl border text-left transition ${
                  on
                    ? "bg-primary/15 border-primary"
                    : "bg-surface-elevated border-border hover:border-primary/40"
                }`}
              >
                <div className="text-2xl">{meta.emoji}</div>
                <div className="text-sm font-bold mt-1">{meta.label}</div>
                <div className="text-[10px] text-muted-foreground">{meta.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Cover */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Cover</label>
          <div className="mt-2 aspect-[4/5] max-w-xs mx-auto rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center relative">
            {coverUrl ? (
              coverUrl.match(/\.(mp4|webm|mov)/i) ? (
                <video src={coverUrl} className="w-full h-full object-cover" muted autoPlay loop />
              ) : (
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="text-center p-6">
                <div className="text-5xl mb-3">🚨</div>
                <div className="text-3xl font-black tabular-nums">{draft.score}/1000</div>
                <p className="mt-2 text-sm opacity-80 line-clamp-3">"{editingTitle}"</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2 justify-center">
            {userId && (
              <div className="w-48">
                <ReceiptsUploader
                  draftId={draftId}
                  userId={userId}
                  onUploaded={(atts) => setCoverUrl(atts[0]?.url ?? coverUrl)}
                />
              </div>
            )}
            {coverUrl && (
              <button
                onClick={() => setCoverUrl(null)}
                className="px-4 py-3 rounded-full bg-surface-elevated border border-border text-sm"
              >
                Use auto cover
              </button>
            )}
          </div>
        </div>

        {/* Editable title + story */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Title</label>
          <textarea
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            rows={2}
            maxLength={160}
            className="mt-1 w-full bg-surface-elevated border border-border rounded-xl p-3 text-base resize-none focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Story</label>
          <textarea
            value={editingStory}
            onChange={(e) => setEditingStory(e.target.value)}
            rows={5}
            maxLength={600}
            className="mt-1 w-full bg-surface-elevated border border-border rounded-xl p-3 text-base resize-none focus:outline-none focus:border-primary/50"
          />
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex gap-2">
          <button
            onClick={() => navigate({ to: "/spill/$draftId/score", params: { draftId } })}
            className="px-4 py-3 rounded-full bg-surface-elevated border border-border text-sm font-medium"
          >
            ← Score
          </button>
          <button
            onClick={onPublish}
            disabled={publishing || !editingTitle.trim() || editingStory.trim().length < 20}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold disabled:opacity-50"
          >
            {publishing ? "Going live…" : "✨ Publish anonymously"}
          </button>
        </div>
      </div>
    </div>
  );
}

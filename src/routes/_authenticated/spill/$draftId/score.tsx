import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getTeaDraft } from "@/lib/spill.functions";
import { ScoreReveal } from "@/components/drama/ScoreReveal";
import { bandForScore, type ScoreResult, type Subscores } from "@/lib/scan/types";
import type { SpillDraftRow } from "@/lib/spill/types";

export const Route = createFileRoute("/_authenticated/spill/$draftId/score")({
  component: ScorePage,
  head: () => ({ meta: [{ title: "Your Chaos Score" }] }),
});

function ScorePage() {
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getTeaDraft);
  const [draft, setDraft] = useState<SpillDraftRow | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { draft: row } = await load({ data: { draftId } });
        setDraft(row);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load score");
      }
    })();
  }, [draftId, load]);

  if (!draft || draft.score == null) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-sm text-muted-foreground">
        Loading your chaos…
      </div>
    );
  }

  const band = bandForScore(draft.score);
  const subscores = (draft.subscores ?? {}) as unknown as Subscores;
  const result: ScoreResult = {
    totalScore: draft.score,
    subscores,
    category: draft.category ?? band.label,
    categoryKey: band.key,
    percentile: 50,
    tags: draft.extracted?.themes ?? [],
    badges: [],
  };

  const ranking = draft.rankings?.world;

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <button onClick={() => history.back()} className="text-sm text-muted-foreground">
            ← Back
          </button>
          <span className="text-xs font-semibold tracking-widest text-primary">RESULTS</span>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <ScoreReveal result={result} locale={draft.locale} />

        {typeof ranking === "number" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8 }}
            className="rounded-2xl bg-surface-elevated border border-border p-5 text-center"
          >
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              🌎 Drama Olympics
            </div>
            <p className="mt-2 text-2xl font-black">#{ranking} worldwide</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Congratulations… or condolences.
            </p>
          </motion.div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <button
            onClick={() =>
              navigate({ to: "/spill/$draftId/draft", params: { draftId } })
            }
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
          >
            Okay… turn this into a post 👀
          </button>
        </div>
      </div>
    </div>
  );
}

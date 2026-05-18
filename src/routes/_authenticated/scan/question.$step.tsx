// One question per route: /scan/question/:step?scanId=:scanId
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ScanProgress } from "@/components/drama/ScanProgress";
import { DramaQuestion } from "@/components/drama/DramaQuestion";
import {
  getScan,
  saveAnswer,
  completeScan,
} from "@/lib/scan.functions";
import {
  computeFlowPath,
  progressInfo,
  questionByStep,
} from "@/lib/scan/question-engine";
import { isLocale, type Locale } from "@/lib/i18n";
import type { AnswerValue, ScanLocale } from "@/lib/scan/types";

const searchSchema = z.object({ scanId: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/scan/question/$step")({
  validateSearch: (s) => searchSchema.parse(s),
  component: QuestionStep,
});

function QuestionStep() {
  const { step } = Route.useParams();
  const { scanId } = Route.useSearch();
  const navigate = useNavigate();
  const stepIdx = Math.max(0, parseInt(step, 10) || 0);

  const fetchScan = useServerFn(getScan);
  const saveFn = useServerFn(saveAnswer);
  const completeFn = useServerFn(completeScan);
  const qc = useQueryClient();

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => fetchScan({ data: { scanId } }),
  });

  const [saving, setSaving] = useState(false);

  const mutate = useMutation({
    mutationFn: async (vars: { questionId: string; value: AnswerValue | null }) => {
      return await saveFn({
        data: {
          scanId,
          questionId: vars.questionId,
          answer: vars.value,
          step: stepIdx,
        },
      });
    },
    onMutate: async ({ questionId, value }) => {
      // Optimistic local update for snappy nav
      qc.setQueryData(["scan", scanId], (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const next = { ...(prev as Record<string, unknown>) };
        const answers = { ...((next.answers as Record<string, unknown>) ?? {}) };
        if (value === null || value === undefined || value === "") delete answers[questionId];
        else answers[questionId] = value;
        next.answers = answers;
        return next;
      });
    },
  });

  if (isLoading || !scan) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (scan.status === "completed") {
    navigate({ to: "/scan/result/$scanId", params: { scanId } });
    return null;
  }

  const answers = scan.answers;
  const locale: ScanLocale = (isLocale(scan.locale) ? scan.locale : "en") as Locale;
  const q = questionByStep(stepIdx, answers);

  if (!q) {
    // Path exhausted — complete the scan
    void (async () => {
      try {
        await completeFn({ data: { scanId } });
        qc.invalidateQueries({ queryKey: ["scan", scanId] });
        navigate({ to: "/scan/result/$scanId", params: { scanId }, replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not finish scan");
      }
    })();
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Calculating your drama score…
      </div>
    );
  }

  const prog = progressInfo(stepIdx, answers);

  const onSubmit = async (value: AnswerValue | null) => {
    setSaving(true);
    try {
      const res = await mutate.mutateAsync({ questionId: q.id, value });
      qc.invalidateQueries({ queryKey: ["scan", scanId] });
      if (res.isDone) {
        await completeFn({ data: { scanId } });
        qc.invalidateQueries({ queryKey: ["scan", scanId] });
        navigate({ to: "/scan/result/$scanId", params: { scanId }, replace: true });
        return;
      }
      navigate({
        to: "/scan/question/$step",
        params: { step: String(res.nextStep) },
        search: { scanId },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onBack = stepIdx > 0
    ? () => {
        // Recompute path from current answers to find previous visible q
        const path = computeFlowPath(answers);
        const prev = Math.max(0, Math.min(stepIdx - 1, path.length - 1));
        navigate({
          to: "/scan/question/$step",
          params: { step: String(prev) },
          search: { scanId },
        });
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScanProgress
        step={stepIdx}
        total={prog.total}
        etaSeconds={prog.etaSeconds}
        locale={locale}
        onBack={onBack}
      />
      <DramaQuestion
        question={q}
        initialAnswer={answers[q.id] as AnswerValue | undefined}
        locale={locale}
        onSubmit={onSubmit}
        saving={saving}
      />
    </div>
  );
}

// Server functions for the Shutap Relationship Scan engine.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateDramaScore } from "@/lib/scan/drama-score";
import {
  computeAdaptiveFlow,
  computeFlowPath,
  getInitialFlow,
  progressInfo,
} from "@/lib/scan/question-engine";
import type {
  AnswerMap,
  AnswerValue,
  ScoreResult,
} from "@/lib/scan/types";
import type { Locale } from "@/lib/i18n";

// ---------- Shared types ----------

export interface ScanRow {
  id: string;
  user_id: string;
  locale: string;
  status: "in_progress" | "completed";
  current_step: number;
  answers: AnswerMap;
  flow_path: string[];
  score: number | null;
  subscores: ScoreResult["subscores"] | null;
  category: string | null;
  percentile: number | null;
  tags: string[];
  badges: string[];
  post_id: string | null;
  created_at: string;
  completed_at: string | null;
}

function rowToScan(row: Record<string, unknown>): ScanRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    locale: (row.locale as string) ?? "en",
    status: (row.status as ScanRow["status"]) ?? "in_progress",
    current_step: (row.current_step as number) ?? 0,
    answers: ((row.answers as AnswerMap) ?? {}) as AnswerMap,
    flow_path: ((row.flow_path as string[]) ?? []) as string[],
    score: (row.score as number | null) ?? null,
    subscores: (row.subscores as ScoreResult["subscores"] | null) ?? null,
    category: (row.category as string | null) ?? null,
    percentile: (row.percentile as number | null) ?? null,
    tags: ((row.tags as string[]) ?? []) as string[],
    badges: ((row.badges as string[]) ?? []) as string[],
    post_id: (row.post_id as string | null) ?? null,
    created_at: row.created_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
  };
}

const SCAN_COLS =
  "id, user_id, locale, status, current_step, answers, flow_path, score, subscores, category, percentile, tags, badges, post_id, created_at, completed_at";

// ---------- startScan ----------

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ locale: z.string().min(2).max(8).default("en") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ScanRow> => {
    const { supabase, userId } = context;
    const flow = getInitialFlow();
    const { data: row, error } = await supabase
      .from("scan_results")
      .insert({
        user_id: userId,
        locale: data.locale,
        status: "in_progress",
        current_step: 0,
        answers: {},
        flow_path: flow,
      } as never)
      .select(SCAN_COLS)
      .single();
    if (error) throw new Error(error.message);
    return rowToScan(row as Record<string, unknown>);
  });

// ---------- getScan ----------

export const getScan = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ scanId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<ScanRow | null> => {
    // Use admin client because completed scans should be publicly viewable
    // (for share links), and RLS already enforces "completed OR owner".
    const { data: row, error } = await supabaseAdmin
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("id", data.scanId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return rowToScan(row as Record<string, unknown>);
  });

// ---------- listMyScans ----------

export const listMyScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToScan(r as Record<string, unknown>));
  });

// ---------- getActiveScan (resume) ----------

export const getActiveScan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanRow | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToScan(data as Record<string, unknown>) : null;
  });

// ---------- saveAnswer ----------

const answerValueSchema: z.ZodType<AnswerValue> = z.union([
  z.string().max(2000),
  z.array(z.string().max(200)).max(50),
  z.number().min(-1000).max(1000),
]);

export const saveAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scanId: z.string().uuid(),
        questionId: z.string().min(1).max(64),
        answer: answerValueSchema.nullable(),
        step: z.number().int().min(0).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load current scan
    const { data: existing, error: loadErr } = await supabase
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Scan not found");

    const row = rowToScan(existing as Record<string, unknown>);
    const nextAnswers: AnswerMap = { ...row.answers };
    if (data.answer === null || data.answer === undefined || data.answer === "") {
      delete nextAnswers[data.questionId];
    } else {
      nextAnswers[data.questionId] = data.answer;
    }

    // Adaptive: re-rank remaining questions based on this fresh answer.
    const nextFlow = computeAdaptiveFlow(nextAnswers, data.questionId);
    const nextStep = data.step + 1;
    const isDone = nextStep >= nextFlow.length;

    const { error: updErr } = await supabase
      .from("scan_results")
      .update({
        answers: nextAnswers,
        flow_path: nextFlow,
        current_step: isDone ? nextFlow.length : nextStep,
      } as never)
      .eq("id", data.scanId)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    const progress = progressInfo(nextStep, nextAnswers);
    return {
      nextQuestionId: isDone ? null : nextFlow[nextStep],
      nextStep: isDone ? -1 : nextStep,
      isDone,
      progress,
    };
  });

// ---------- saveAnswersBatch ----------
// Merge many answers in one update — used by the quick viral flow so we don't
// pay N round-trips for N screens.
export const saveAnswersBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scanId: z.string().uuid(),
        answers: z.record(z.string().min(1).max(64), answerValueSchema),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: loadErr } = await supabase
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Scan not found");
    const row = rowToScan(existing as Record<string, unknown>);
    const nextAnswers: AnswerMap = { ...row.answers, ...data.answers };
    const nextFlow = computeFlowPath(nextAnswers);
    const { error: updErr } = await supabase
      .from("scan_results")
      .update({
        answers: nextAnswers,
        flow_path: nextFlow,
        current_step: nextFlow.length,
      } as never)
      .eq("id", data.scanId)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// ---------- completeScan ----------

export const completeScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scanId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ScanRow> => {
    const { supabase, userId } = context;

    const { data: existing, error: loadErr } = await supabase
      .from("scan_results")
      .select(SCAN_COLS)
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Scan not found");

    const row = rowToScan(existing as Record<string, unknown>);
    const result = calculateDramaScore(row.answers);

    const { data: updated, error: updErr } = await supabase
      .from("scan_results")
      .update({
        status: "completed",
        score: result.totalScore,
        subscores: result.subscores as unknown as Record<string, number>,
        category: result.category,
        percentile: result.percentile,
        tags: result.tags,
        badges: result.badges,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .select(SCAN_COLS)
      .single();
    if (updErr) throw new Error(updErr.message);

    return rowToScan(updated as Record<string, unknown>);
  });

// ---------- linkScanToPost ----------
// Called from /compose after publish so the scan record knows which post
// it was turned into.

export const linkScanToPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ scanId: z.string().uuid(), postId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scan_results")
      .update({ post_id: data.postId } as never)
      .eq("id", data.scanId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type { Locale };

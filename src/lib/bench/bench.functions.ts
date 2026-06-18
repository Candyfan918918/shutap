// The Bench — server functions wiring the 7-prompt library.
// All callers MUST run safety (Prompt 7) before any other Bench prompt.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGatewayJSON } from "@/lib/ai/gateway";
import {
  buildFollowUp,
  buildObjection,
  buildOverturned,
  buildPromotion,
  buildSafety,
  buildScanCard,
  buildSeedReaction,
  FollowUpSchema,
  ObjectionSchema,
  OverturnedSchema,
  PromotionSchema,
  SafetySchema,
  ScanCardSchema,
  SeedReactionSchema,
  type SafetyResult,
} from "@/lib/bench/prompts.server";

// Model selection per spec.
const FAST_MODEL = "google/gemini-3-flash-preview";
const STRONG_MODEL = "google/gemini-2.5-pro";

type Built = { system: string; user: string };

async function runPrompt<T>(
  built: Built,
  schema: z.ZodType<T>,
  model: string,
  temperature = 0.7,
): Promise<T> {
  const raw = await callGatewayJSON<unknown>({
    model,
    temperature,
    messages: [
      { role: "system", content: built.system },
      { role: "user", content: built.user },
    ],
  });
  return schema.parse(raw);
}

// ---------- Public helper used by other server fns (no createServerFn wrapper) ----------
// Returns the safety result. Callers must short-circuit when block_normal_processing=true.
// On any failure (network, parse), FAIL CLOSED: treat as risk.
export async function runSafetyRouter(caseText: string): Promise<SafetyResult> {
  try {
    return await runPrompt(buildSafety({ caseText }), SafetySchema, STRONG_MODEL, 0.2);
  } catch (e) {
    return {
      risk_detected: true,
      risk_type: "none",
      block_normal_processing: true,
      response_comment:
        "The Bench could not safely review this submission. Try again in a moment.",
      surface_resources: false,
    };
  }
}

// ---------- 1. Seed bench reaction (idempotent per post) ----------
export async function seedBenchReactionFor(postId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, title, story_text, score_category, bench_seed_at")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return false;
  if (post.bench_seed_at) return false;
  try {
    const out = await runPrompt(
      buildSeedReaction({
        caseTitle: post.title ?? "Untitled",
        caseText: post.story_text ?? "",
        category: post.score_category ?? "general",
      }),
      SeedReactionSchema,
      FAST_MODEL,
      0.85,
    );
    await supabaseAdmin
      .from("posts")
      .update({
        bench_seed_lean: out.lean,
        bench_seed_verdict_tag: out.verdict_tag,
        bench_seed_comment: out.comment,
        bench_seed_at: new Date().toISOString(),
      })
      .eq("id", postId);
    return true;
  } catch {
    return false;
  }
}

export const seedBenchReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ok = await seedBenchReactionFor(data.postId);
    return { ok };
  });


// ---------- 2. Scan card ----------
export async function runScanCardFor(scanId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: scan } = await supabaseAdmin
    .from("scan_results")
    .select("id, category, answers")
    .eq("id", scanId)
    .maybeSingle();
  if (!scan) return false;
  const answers = (scan.answers ?? {}) as Record<string, unknown>;
  const scanAnswers = Object.entries(answers).map(([q, a]) => ({
    question: q,
    answer: typeof a === "string" ? a : JSON.stringify(a),
  }));
  try {
    const out = await runPrompt(
      buildScanCard({ category: scan.category ?? "general", scanAnswers }),
      ScanCardSchema,
      FAST_MODEL,
      0.9,
    );
    await supabaseAdmin
      .from("scan_results")
      .update({
        bench_label: out.label,
        bench_read: out.read,
        bench_share_line: out.share_line,
        bench_lean: out.lean,
      } as never)
      .eq("id", scanId);
    return true;
  } catch {
    return false;
  }
}

export const runScanCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scanId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await runScanCardFor(data.scanId);
    return { ok: true };
  });


// ---------- 3. Objection (hard-cap one per post) ----------
export const runObjection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        objectionText: z.string().min(2).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, author_id, story_text, bench_seed_comment, bench_objection_used")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post not found");
    if (post.author_id !== userId) throw new Error("Only the author can object");
    if (post.bench_objection_used) throw new Error("Objection already used");
    if (!post.bench_seed_comment) throw new Error("No first read yet");

    const out = await runPrompt(
      buildObjection({
        originalComment: post.bench_seed_comment,
        caseText: post.story_text ?? "",
        objectionText: data.objectionText,
      }),
      ObjectionSchema,
      STRONG_MODEL,
      0.6,
    );

    await supabaseAdmin
      .from("posts")
      .update({
        bench_objection_used: true,
        bench_objection_response: {
          ...out,
          objection_text: data.objectionText,
          at: new Date().toISOString(),
        } as never,
      })
      .eq("id", data.postId)
      .eq("bench_objection_used", false);
    return out;
  });

// ---------- 4. Court promotion ----------
export async function runCourtPromotionFor(caseId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cc } = await supabaseAdmin
    .from("court_cases")
    .select(
      "id, post_id, current_tier, scope, bench_promotion_line, posts:posts!court_cases_post_id_fkey(title, score_category, relate_count)",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (!cc || cc.bench_promotion_line) return false;
  const post = (cc as any).posts;
  if (!post) return false;
  const tierMap: Record<string, "Neighbourhood" | "City" | "Regional" | "National" | "World"> = {
    city: "City",
    regional: "Regional",
    national: "National",
    world: "World",
  };
  try {
    const out = await runPrompt(
      buildPromotion({
        caseTitle: post.title ?? "Untitled",
        feltCount: post.relate_count ?? 0,
        category: post.score_category ?? "general",
      }),
      PromotionSchema,
      FAST_MODEL,
      0.8,
    );
    await supabaseAdmin
      .from("court_cases")
      .update({
        bench_promotion_line: out.comment,
        bench_promotion_at: new Date().toISOString(),
      })
      .eq("id", caseId);
    return true;
  } catch {
    return false;
  }
}

// ---------- 5. Overturned recap ----------
export async function runOverturnedRecapFor(caseId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cc } = await supabaseAdmin
    .from("court_cases")
    .select("id, post_id, final_verdict, status")
    .eq("id", caseId)
    .maybeSingle();
  if (!cc || cc.status !== "decided") return false;

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, bench_seed_lean, bench_seed_comment, bench_overturned_at, author_id")
    .eq("id", cc.post_id)
    .maybeSingle();
  if (!post || !post.bench_seed_lean || !post.bench_seed_comment) return false;
  if (post.bench_overturned_at) return false;

  const { data: votes } = await supabaseAdmin
    .from("post_verdict_votes")
    .select("kind")
    .eq("post_id", cc.post_id);
  const dist: Record<string, number> = {};
  for (const v of (votes ?? []) as any[]) dist[v.kind] = (dist[v.kind] ?? 0) + 1;

  // Derive majority "lean": agree if dominant tag matches seed verdict_tag bucket
  const finalTag = cc.final_verdict ?? "";
  const seedAgreesWithJury =
    (post.bench_seed_lean === "agree" && ["green_flag", "talk_it_out"].includes(finalTag)) ||
    (post.bench_seed_lean === "disagree" && ["red_flag", "run", "lawyer_up"].includes(finalTag));
  const majorityLean = seedAgreesWithJury ? "agree" : "disagree";

  try {
    const out = await runPrompt(
      buildOverturned({
        seedLean: post.bench_seed_lean,
        seedComment: post.bench_seed_comment,
        finalVerdictBreakdown: dist,
        majorityLean,
      }),
      OverturnedSchema,
      STRONG_MODEL,
      0.6,
    );
    await supabaseAdmin
      .from("posts")
      .update({
        bench_overturned_outcome: out.outcome,
        bench_overturned_comment: out.comment,
        bench_overturned_at: new Date().toISOString(),
      })
      .eq("id", cc.post_id);

    // If overturned, drop a HOF nomination row (best-effort)
    if (out.outcome === "overturned" && post.author_id) {
      try {
        await supabaseAdmin.from("hof_nominations").insert({
          post_id: cc.post_id,
          nominator_id: post.author_id,
          category: "bench_overturned",
        } as never);
      } catch {
        /* hof_nominations schema may not include this category; ignore */
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ---------- 6. Follow-up ----------
export async function runFollowUpFor(postId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, title")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return false;
  const { data: cc } = await supabaseAdmin
    .from("court_cases")
    .select("decided_at, final_verdict")
    .eq("post_id", postId)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cc?.decided_at || !cc.final_verdict) return false;
  const days = Math.floor(
    (Date.now() - new Date(cc.decided_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  try {
    const out = await runPrompt(
      buildFollowUp({
        caseTitle: post.title ?? "Untitled",
        daysSinceVerdict: days,
        majorityVerdict: cc.final_verdict,
      }),
      FollowUpSchema,
      STRONG_MODEL,
      0.7,
    );
    await supabaseAdmin
      .from("bench_followups")
      .insert({ post_id: postId, comment: out.comment, cta_label: out.cta_label } as never);
    return true;
  } catch {
    return false;
  }
}

// ---------- Read-only fetch for UI ----------
export const getBenchSeed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("posts")
      .select(
        "bench_seed_lean, bench_seed_verdict_tag, bench_seed_comment, bench_objection_used, bench_objection_response, bench_overturned_outcome, bench_overturned_comment, safety_blocked",
      )
      .eq("id", data.postId)
      .maybeSingle();
    return row ?? null;
  });

export const getMyBenchFollowups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("bench_followups")
      .select("id, post_id, comment, cta_label, posts!inner(author_id, title)")
      .eq("posts.author_id", userId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as Array<{
      id: string;
      post_id: string;
      comment: string;
      cta_label: string;
      posts: { title: string };
    }>;
  });

export const dismissBenchFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("bench_followups")
      .update({ dismissed_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    return { ok: true };
  });

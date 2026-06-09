// Multi-party perspectives — named-party / participant / witness responses
// to a published story, with standing verification.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";

const ROLE = z.enum(["named_party", "participant", "witness"]);

type AnyCtx = { userId: string; supabase: any };

// ---------- start ----------
export const startPerspective = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((i: unknown) =>
    z.object({ post_id: z.string().uuid(), role: ROLE }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block author of the post from responding to their own post.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("author_id")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) throw new Error("not_found");
    if (post.author_id === ctx.userId) throw new Error("plaintiff_cannot_respond");

    const { data: row, error } = await supabaseAdmin
      .from("post_perspectives")
      .upsert(
        {
          post_id: data.post_id,
          responder_id: ctx.userId,
          role: data.role,
          standing_status: "pending",
        },
        { onConflict: "post_id,responder_id" },
      )
      .select("id, standing_status")
      .single();
    if (error) throw new Error(error.message);
    return { perspective_id: row.id as string, standing_status: row.standing_status as string };
  });

// ---------- submit standing facts ----------
export const submitStandingFacts = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((i: unknown) =>
    z.object({
      perspective_id: z.string().uuid(),
      claimed_facts: z.record(z.string(), z.unknown()),
      receipts_urls: z.array(z.string().url()).max(5).default([]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: p } = await supabaseAdmin
      .from("post_perspectives")
      .select("id, post_id, responder_id, role, standing_status, locked_at")
      .eq("id", data.perspective_id)
      .maybeSingle();
    if (!p || p.responder_id !== ctx.userId) throw new Error("not_found");
    if (p.locked_at) throw new Error("locked");
    if (p.standing_status === "verified") {
      return { verified: true };
    }

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("story_text")
      .eq("id", p.post_id)
      .single();
    const excerpt = (post?.story_text ?? "").slice(0, 800);

    const { runMoment } = await import("@/lib/orchestrator.server");
    const result = await runMoment({
      moment: "standing_verify",
      userId: ctx.userId,
      payload: {
        post_excerpt: excerpt,
        role: p.role,
        claimed_facts: data.claimed_facts,
        receipts_present: data.receipts_urls.length > 0,
      },
    });
    // standing_judge is PRIVATE — not in results. Re-run with admin to get judge output is overkill; we log it via ai_call_log + standing_verifications.
    // Re-run logic: ask the judge directly inline (cheap) to get verdict + persist.
    const { callGatewayJSON } = await import("@/lib/ai/gateway");
    const { AGENT_PROMPTS, modelFor } = await import("@/lib/agent-prompts.server");
    const judge = await callGatewayJSON<{
      verified: boolean;
      score: number;
      reasoning: string;
      missing_signals?: string[];
    }>({
      model: modelFor("standing_judge"),
      messages: [
        { role: "system", content: AGENT_PROMPTS.standing_judge },
        {
          role: "user",
          content: JSON.stringify({
            post_excerpt: excerpt,
            role: p.role,
            claimed_facts: data.claimed_facts,
            receipts_present: data.receipts_urls.length > 0,
          }),
        },
      ],
    });

    const decision: "verified" | "failed" = judge.verified ? "verified" : "failed";

    // Count prior attempts.
    const { count } = await supabaseAdmin
      .from("standing_verifications")
      .select("id", { count: "exact", head: true })
      .eq("perspective_id", p.id);

    await supabaseAdmin.from("standing_verifications").insert({
      perspective_id: p.id,
      responder_id: ctx.userId,
      attempt_no: (count ?? 0) + 1,
      claimed_facts: data.claimed_facts as never,
      agent_output: judge as never,
      decision,
    });


    await supabaseAdmin
      .from("post_perspectives")
      .update({
        standing_status: decision,
        standing_score: judge.score,
        standing_notes: judge.reasoning,
        receipts_urls: data.receipts_urls,
      })
      .eq("id", p.id);

    // privacy_shield ran via runMoment; ignore its output here.
    void result;

    return { verified: judge.verified };
  });

// ---------- submit response ----------
export const submitPerspectiveResponse = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((i: unknown) =>
    z.object({
      perspective_id: z.string().uuid(),
      response_text: z.string().min(20).max(4000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: p } = await supabaseAdmin
      .from("post_perspectives")
      .select("id, post_id, responder_id, role, standing_status, locked_at, response_text")
      .eq("id", data.perspective_id)
      .maybeSingle();
    if (!p || p.responder_id !== ctx.userId) throw new Error("not_found");
    if (p.locked_at) throw new Error("locked");
    if (p.standing_status !== "verified") throw new Error("not_verified");

    await supabaseAdmin
      .from("post_perspectives")
      .update({ response_text: data.response_text })
      .eq("id", p.id);

    // Flip post-level flags + count on first response only.
    if (!p.response_text) {
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("perspective_count")
        .eq("id", p.post_id)
        .single();

      const update =
        p.role === "named_party"
          ? { both_sides_heard: true, perspective_count: (post?.perspective_count ?? 0) + 1 }
          : { additional_perspectives: true, perspective_count: (post?.perspective_count ?? 0) + 1 };

      await supabaseAdmin.from("posts").update(update).eq("id", p.post_id);
    }


    return { ok: true };
  });

// ---------- list (public) ----------
export const listPerspectives = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("post_perspectives")
      .select(
        "id, post_id, responder_id, role, response_text, relate_count, comment_count, locked_at, created_at",
      )
      .eq("post_id", data.post_id)
      .eq("standing_status", "verified")
      .not("response_text", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { perspectives: rows ?? [] };
  });

// ---------- relate ----------
export const togglePerspectiveRelate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ perspective_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("post_perspective_relates")
      .select("perspective_id")
      .eq("perspective_id", data.perspective_id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("post_perspective_relates")
        .delete()
        .eq("perspective_id", data.perspective_id)
        .eq("user_id", ctx.userId);
      await supabaseAdmin.rpc("pp_bump_relate", {
        _id: data.perspective_id,
        _delta: -1,
      } as never).then(() => {}, () => {});
      return { related: false };
    }
    await supabaseAdmin
      .from("post_perspective_relates")
      .insert({ perspective_id: data.perspective_id, user_id: ctx.userId });
    // Fallback: best-effort counter bump via direct update.
    const { data: row } = await supabaseAdmin
      .from("post_perspectives")
      .select("relate_count")
      .eq("id", data.perspective_id)
      .single();
    await supabaseAdmin
      .from("post_perspectives")
      .update({ relate_count: (row?.relate_count ?? 0) + 1 })
      .eq("id", data.perspective_id);
    return { related: true };
  });

// ---------- comment ----------
export const commentPerspective = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((i: unknown) =>
    z.object({
      perspective_id: z.string().uuid(),
      body: z.string().min(1).max(1000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("post_perspective_comments")
      .insert({
        perspective_id: data.perspective_id,
        author_id: ctx.userId,
        body: data.body,
      });
    if (error) throw new Error(error.message);
    const { data: row } = await supabaseAdmin
      .from("post_perspectives")
      .select("comment_count")
      .eq("id", data.perspective_id)
      .single();
    await supabaseAdmin
      .from("post_perspectives")
      .update({ comment_count: (row?.comment_count ?? 0) + 1 })
      .eq("id", data.perspective_id);
    return { ok: true };
  });

// ---------- verdict (sub-thread) ----------
export const castPerspectiveVerdict = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((i: unknown) =>
    z.object({
      perspective_id: z.string().uuid(),
      kind: z.string().min(2).max(40),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as AnyCtx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("post_perspectives")
      .select("locked_at")
      .eq("id", data.perspective_id)
      .single();
    if (p?.locked_at) throw new Error("locked");
    const { error } = await supabaseAdmin
      .from("post_perspective_verdicts")
      .upsert(
        {
          perspective_id: data.perspective_id,
          user_id: ctx.userId,
          kind: data.kind,
          weight: 1,
        },
        { onConflict: "perspective_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

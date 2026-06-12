// Mod queue — admin-only review of paused candidacy.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function gateAdmin() {
  const { requireAdminSession } = await import("./session.server");
  const { assertAdmin } = await import("./role.server");
  const session = await requireAdminSession();
  await assertAdmin(session.adminId);
  return session;
}

export type ModReason = "pii_suspected" | "mass_flag" | "legal_risk" | "manual_hold" | "rate_limited";
export type ModStatus = "pending" | "approved" | "rejected";

export interface ModQueueItem {
  id: string;
  caseId: string | null;
  postId: string;
  reason: ModReason;
  status: ModStatus;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  post: { id: string; title: string; storyText: string; authorId: string } | null;
}

export const listModQueue = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    await gateAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("mod_queue")
      .select("id, case_id, post_id, reason, status, notes, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const postIds = Array.from(new Set((rows ?? []).map((r: any) => r.post_id)));
    const postMap = new Map<string, { id: string; title: string; storyText: string; authorId: string }>();
    if (postIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from("posts")
        .select("id, title, story_text, author_id")
        .in("id", postIds);
      for (const p of (posts ?? []) as any[]) {
        postMap.set(p.id, {
          id: p.id,
          title: p.title,
          storyText: (p.story_text ?? "").slice(0, 500),
          authorId: p.author_id,
        });
      }
    }

    const items: ModQueueItem[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      caseId: r.case_id,
      postId: r.post_id,
      reason: r.reason,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      post: postMap.get(r.post_id) ?? null,
    }));
    return { items };
  });

export const resolveQueueItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      notes: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const session = await gateAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: item, error: lerr } = await supabaseAdmin
      .from("mod_queue")
      .select("id, case_id, post_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (lerr) throw new Error(lerr.message);
    if (!item) throw new Error("not_found");
    if (item.status !== "pending") throw new Error("already_resolved");

    await supabaseAdmin
      .from("mod_queue")
      .update({
        status: data.decision,
        moderator_id: session.adminId,
        notes: data.notes ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (item.case_id) {
      if (data.decision === "approved") {
        await supabaseAdmin
          .from("court_cases")
          .update({ status: "nominated", candidacy_paused: false })
          .eq("id", item.case_id);
      } else {
        await supabaseAdmin
          .from("court_cases")
          .update({ status: "rejected", candidacy_paused: true })
          .eq("id", item.case_id);
      }
    }

    // Notify post author with Bench voice.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("author_id")
      .eq("id", item.post_id)
      .maybeSingle();
    if (post?.author_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: post.author_id,
        kind: data.decision === "approved" ? "court_mod_approved" : "court_mod_rejected",
        payload: {
          post_id: item.post_id,
          case_id: item.case_id,
          message:
            data.decision === "approved"
              ? "Bench accepted the case. Court is open."
              : "Bench declined to hear this one. Try a different framing.",
        },
      });
    }

    return { ok: true };
  });

// Internal helper for nomination engine: push to queue + pause case.
export async function pushToModQueue(args: {
  postId: string;
  caseId?: string | null;
  reason: ModReason;
  notes?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mod_queue")
    .insert({
      post_id: args.postId,
      case_id: args.caseId ?? null,
      reason: args.reason,
      notes: args.notes ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (args.caseId) {
    await supabaseAdmin
      .from("court_cases")
      .update({ status: "paused", candidacy_paused: true })
      .eq("id", args.caseId);
  }
  return { id: (data as any).id as string };
}

// Admin moderation queue server functions. Service-role reads/writes via
// supabaseAdmin, gated by admin session (super_admin or moderator).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AnyRow = Record<string, any>;

const ACTIONS = [
  "no_action",
  "warn_user",
  "remove_content",
  "suspend_7d",
  "ban",
  "escalate",
  "refer_to_legal",
] as const;

const OVERRIDE_REASONS = [
  "evidence_insufficient",
  "context_changes_assessment",
  "policy_interpretation_differs",
  "edge_case",
  "other",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

async function gate() {
  const { requireAdminSession } = await import("./session.server");
  return requireAdminSession({ roles: ["super_admin", "moderator"] });
}

function isOpen(status: string) {
  return status === "pending" || status === "open";
}

/** List queue items with filters. Always service-role; admin-only access. */
export const listModQueue = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      severity: z.enum(SEVERITIES).optional(),
      entityType: z.string().min(1).max(40).optional(),
      status: z.enum(["open", "resolved", "all"]).default("open"),
      assignedTo: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("mod_queue")
      .select(
        "id, severity, entity_type, entity_id, post_id, comment_id, reason, status, priority_score, ai_recommendation, ai_confidence, assigned_admin_id, created_at, resolved_at"
      )
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.severity) q = q.eq("severity", data.severity);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.status === "open") q = q.in("status", ["pending", "open"]);
    else if (data.status === "resolved") q = q.in("status", ["approved", "rejected", "resolved", "escalated"]);
    if (data.assignedTo === null) q = q.is("assigned_admin_id", null);
    else if (data.assignedTo) q = q.eq("assigned_admin_id", data.assignedTo);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as AnyRow[] };
  });

/** Detail view: queue item + entity content + AI triage + author history. */
export const getModQueueItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error } = await supabaseAdmin
      .from("mod_queue")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) {
      const e: any = new Error("not_found");
      e.statusCode = 404;
      throw e;
    }
    const row = item as AnyRow;

    // Entity content
    let entity: AnyRow | null = null;
    let authorId: string | null = null;
    if (row.entity_type === "comment" && row.comment_id) {
      const { data: c } = await supabaseAdmin
        .from("post_comments")
        .select("id, body, author_id, post_id, created_at, status")
        .eq("id", row.comment_id)
        .maybeSingle();
      entity = (c as AnyRow) ?? null;
      authorId = (c as AnyRow)?.author_id ?? null;
    } else if (row.post_id) {
      const { data: p } = await supabaseAdmin
        .from("posts")
        .select("id, title, body, author_id, status, visibility, created_at")
        .eq("id", row.post_id)
        .maybeSingle();
      entity = (p as AnyRow) ?? null;
      authorId = (p as AnyRow)?.author_id ?? null;
    }

    // Latest AI triage result for the entity
    let triage: AnyRow | null = null;
    if (row.entity_id) {
      const { data: t } = await supabaseAdmin
        .from("ai_triage_results")
        .select("*")
        .eq("entity_type", row.entity_type)
        .eq("entity_id", row.entity_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      triage = (t as AnyRow) ?? null;
    }

    // Author history — alias + account age + prior queue flags + prior actions
    let author: AnyRow | null = null;
    let priorFlags = 0;
    let priorActions: AnyRow[] = [];
    if (authorId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname, handle, created_at")
        .eq("id", authorId)
        .maybeSingle();
      author = (prof as AnyRow) ?? null;

      const { count: flagCount } = await supabaseAdmin
        .from("mod_queue")
        .select("id", { count: "exact", head: true })
        .or(`post_id.eq.${authorId},entity_id.eq.${authorId}`);
      // The .or above is best-effort; not all entities are user-typed.
      priorFlags = flagCount ?? 0;

      const { data: actions } = await supabaseAdmin
        .from("mod_actions")
        .select("id, action, created_at, notes")
        .eq("entity_type", "user")
        .eq("entity_id", authorId)
        .order("created_at", { ascending: false })
        .limit(10);
      priorActions = (actions as AnyRow[]) ?? [];
    }

    return {
      item: row,
      entity,
      triage,
      author,
      priorFlags,
      priorActions,
    };
  });

/** Submit a moderator decision. Writes to mod_actions (append-only) and resolves the queue item. */
export const submitModAction = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      queueItemId: z.string().uuid(),
      action: z.enum(ACTIONS),
      overrideReason: z.enum(OVERRIDE_REASONS).optional().nullable(),
      notes: z.string().max(4000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const session = await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: itemRaw, error: getErr } = await supabaseAdmin
      .from("mod_queue").select("*").eq("id", data.queueItemId).maybeSingle();
    if (getErr) throw new Error(getErr.message);
    const item = itemRaw as AnyRow | null;
    if (!item) {
      const e: any = new Error("not_found");
      e.statusCode = 404;
      throw e;
    }
    if (!isOpen(item.status)) {
      const e: any = new Error("already_resolved");
      e.statusCode = 409;
      throw e;
    }

    const aiRec = item.ai_recommendation as string | null;
    const accepted = !!aiRec && aiRec === data.action;

    // Required fields by policy
    if (!accepted && aiRec && !data.overrideReason) {
      const e: any = new Error("override_reason_required");
      e.statusCode = 400;
      throw e;
    }
    if (data.action === "ban" && !data.notes?.trim()) {
      const e: any = new Error("notes_required_for_ban");
      e.statusCode = 400;
      throw e;
    }

    const { error: insErr } = await supabaseAdmin.from("mod_actions").insert({
      admin_id: session.adminId,
      admin_email: session.email,
      admin_role: session.role,
      queue_item_id: item.id,
      entity_type: item.entity_type,
      entity_id: item.entity_id ?? item.post_id,
      action: data.action,
      ai_recommendation: aiRec,
      accepted_ai_rec: accepted,
      override_reason: accepted ? null : data.overrideReason ?? null,
      notes: data.notes?.trim() || null,
    });
    if (insErr) throw new Error(insErr.message);

    const nextStatus = data.action === "escalate" ? "escalated" : "resolved";
    const { error: updErr } = await supabaseAdmin
      .from("mod_queue")
      .update({
        status: nextStatus,
        moderator_id: null, // auth.users-scoped column; admin lives in mod_actions instead
        resolved_at: new Date().toISOString(),
        notes: data.notes?.trim() || item.notes,
      })
      .eq("id", item.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

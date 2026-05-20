// Server functions for the ☕ Spill The Tea™ composer flow.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGatewayJSON } from "@/lib/ai/gateway";
import {
  SPILL_CHAT_INSTRUCTIONS,
  SPILL_PERSONA,
  SPILL_THREE_TONES_PROMPT,
} from "@/lib/spill/system-prompts";
import { bandForScore } from "@/lib/scan/types";
import { scoreCategoryLabel } from "@/lib/posts/types";
import type {
  AiQuestion,
  ChatAttachment,
  ChatMessage,
  SpillDraftRow,
  SpillExtracted,
  ToneVariant,
} from "@/lib/spill/types";

// ---------- helpers ----------

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function chatToTranscript(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const tag = m.role === "user" ? "USER" : m.role === "ai" ? "TEA" : "SYS";
      const att = (m.attachments ?? [])
        .map((a) => `[${a.kind} attached]`)
        .join(" ");
      return `${tag}: ${m.text}${att ? " " + att : ""}`;
    })
    .join("\n");
}

// ---------- schemas ----------

const aiQuestionSchema = z.union([
  z.object({ type: z.literal("text"), placeholder: z.string().max(160).optional() }),
  z.object({
    type: z.literal("tap"),
    options: z.array(z.object({ id: z.string().max(40), label: z.string().max(160) })).min(2).max(6),
  }),
  z.object({
    type: z.literal("multi"),
    options: z.array(z.object({ id: z.string().max(40), label: z.string().max(160) })).min(2).max(10),
  }),
  z.object({
    type: z.literal("slider"),
    min: z.number().optional(),
    max: z.number().optional(),
    minLabel: z.string().max(40).optional(),
    maxLabel: z.string().max(40).optional(),
  }),
]).nullable();

const extractedPatchSchema = z.object({
  relationship_type: z.enum(["marriage", "dating", "breakup", "situationship", "family", "other"]).optional(),
  themes: z.array(z.string().max(40)).max(20).optional(),
  emotion: z.enum(["sad", "angry", "confused", "hopeful", "numb", "shocked"]).optional(),
  intensity: z.number().min(0).max(100).optional(),
  red_flags: z.array(z.string().max(140)).max(20).optional(),
  green_flags: z.array(z.string().max(140)).max(20).optional(),
  key_quotes: z.array(z.string().max(180)).max(8).optional(),
}).partial();

const aiReplySchema = z.object({
  message: z.string().min(1).max(1200),
  question: aiQuestionSchema,
  extracted_patch: extractedPatchSchema.default({}),
  ready_for_score: z.boolean().default(false),
  should_ask_for_receipts: z.boolean().default(false),
});

const attachmentSchema = z.object({
  url: z.string().url(),
  kind: z.enum(["image", "video", "audio"]),
  name: z.string().max(200).optional(),
});

function mergeExtracted(prev: SpillExtracted, patch: z.infer<typeof extractedPatchSchema>): SpillExtracted {
  return {
    relationship_type: patch.relationship_type ?? prev.relationship_type,
    emotion: patch.emotion ?? prev.emotion,
    intensity: patch.intensity ?? prev.intensity,
    themes: Array.from(new Set([...(prev.themes ?? []), ...(patch.themes ?? [])])),
    red_flags: Array.from(new Set([...(prev.red_flags ?? []), ...(patch.red_flags ?? [])])),
    green_flags: Array.from(new Set([...(prev.green_flags ?? []), ...(patch.green_flags ?? [])])),
    key_quotes: Array.from(new Set([...(prev.key_quotes ?? []), ...(patch.key_quotes ?? [])])).slice(0, 8),
  };
}

// ---------- createTeaDraft ----------

export const createTeaDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rawDump: z.string().max(8000).default(""),
        attachments: z.array(attachmentSchema).max(10).default([]),
        locale: z.string().min(2).max(8).default("en"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draftId: string }> => {
    const { supabase, userId } = context;
    const firstMessages: ChatMessage[] = data.rawDump.trim() || data.attachments.length
      ? [
          {
            id: makeId(),
            role: "user",
            text: data.rawDump.trim(),
            attachments: data.attachments,
            created_at: nowIso(),
          },
        ]
      : [];

    const { data: row, error } = await supabase
      .from("tea_drafts")
      .insert({
        user_id: userId,
        locale: data.locale,
        raw_dump: data.rawDump,
        chat_messages: firstMessages as never,
        media: data.attachments as never,
        status: "chatting",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { draftId: row.id };
  });

// ---------- getTeaDraft ----------

export const getTeaDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ draftId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Draft not found");
    return { draft: row as unknown as SpillDraftRow };
  });

// ---------- sendChatTurn ----------
// One round: user message in → AI reply out → state updated.

export const sendChatTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draftId: z.string().uuid(),
        userText: z.string().max(4000).default(""),
        attachments: z.array(attachmentSchema).max(10).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;

    const { data: existing, error: loadErr } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !existing) throw new Error(loadErr?.message ?? "Draft not found");
    const draft = existing as unknown as SpillDraftRow;

    const messages: ChatMessage[] = [...(draft.chat_messages ?? [])];
    const hasUserPayload = data.userText.trim().length > 0 || data.attachments.length > 0;
    if (hasUserPayload) {
      messages.push({
        id: makeId(),
        role: "user",
        text: data.userText.trim(),
        attachments: data.attachments,
        created_at: nowIso(),
      });
    }

    const transcript = chatToTranscript(messages);
    const extractedSoFar = JSON.stringify(draft.extracted ?? {});
    const mediaCount = (draft.media ?? []).length + data.attachments.length;

    const userPrompt = `Locale: ${draft.locale}
So far extracted: ${extractedSoFar}
Media uploaded so far: ${mediaCount} item(s)

TRANSCRIPT:
${transcript}

Respond as Tea. Follow the JSON shape exactly.`;

    const ai = await callGatewayJSON<unknown>({
      messages: [
        { role: "system", content: SPILL_PERSONA + "\n\n" + SPILL_CHAT_INSTRUCTIONS },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.92,
    });
    const parsed = aiReplySchema.parse(ai);

    const aiQuestion: AiQuestion | undefined = parsed.question ?? undefined;
    messages.push({
      id: makeId(),
      role: "ai",
      text: parsed.message,
      question: aiQuestion,
      created_at: nowIso(),
    });

    const nextExtracted = mergeExtracted(draft.extracted ?? {}, parsed.extracted_patch);
    const nextMedia: ChatAttachment[] = [...(draft.media ?? []), ...data.attachments];

    const { data: updated, error: updErr } = await supabase
      .from("tea_drafts")
      .update({
        chat_messages: messages as never,
        extracted: nextExtracted as never,
        media: nextMedia as never,
        ready_for_score: parsed.ready_for_score,
      })
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return { draft: updated as unknown as SpillDraftRow };
  });

// ---------- attachMedia (no chat turn, just append receipts) ----------

export const attachTeaMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draftId: z.string().uuid(),
        attachments: z.array(attachmentSchema).min(1).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;
    const { data: existing, error: loadErr } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !existing) throw new Error(loadErr?.message ?? "Draft not found");
    const draft = existing as unknown as SpillDraftRow;
    const messages: ChatMessage[] = [...(draft.chat_messages ?? [])];
    messages.push({
      id: makeId(),
      role: "user",
      text: "📱 dropped receipts",
      attachments: data.attachments,
      created_at: nowIso(),
    });
    const media: ChatAttachment[] = [...(draft.media ?? []), ...data.attachments];
    const { data: updated, error } = await supabase
      .from("tea_drafts")
      .update({ chat_messages: messages as never, media: media as never })
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { draft: updated as unknown as SpillDraftRow };
  });

// ---------- computeChaosScore ----------
// Heuristic-based score from extracted signals + AI flavor.

function calcScoreFromSignals(ex: SpillExtracted): {
  total: number;
  subscores: Record<string, number>;
} {
  const themes = new Set(ex.themes ?? []);
  const reds = ex.red_flags?.length ?? 0;
  const greens = ex.green_flags?.length ?? 0;
  const intensity = ex.intensity ?? 50;

  const plot = Math.min(
    200,
    (themes.has("cheating") ? 90 : 0) +
      (themes.has("betrayal") ? 60 : 0) +
      (themes.has("plot_twist") ? 40 : 0) +
      reds * 12,
  );
  const emotional = Math.min(
    200,
    Math.round(intensity * 1.6) +
      (ex.emotion === "shocked" ? 30 : 0) +
      (ex.emotion === "angry" ? 20 : 0),
  );
  const financial = Math.min(
    150,
    (themes.has("money") || themes.has("debt") ? 90 : 0) +
      (themes.has("hidden_account") ? 40 : 0),
  );
  const family = Math.min(
    150,
    (themes.has("mil") || themes.has("in_laws") || themes.has("family") ? 90 : 0) +
      (themes.has("kids") || themes.has("custody") ? 40 : 0),
  );
  const communication = Math.min(
    150,
    (themes.has("communication") || themes.has("silent_treatment") ? 80 : 0) +
      (themes.has("lying") ? 50 : 0),
  );
  const love_bonus = Math.max(-200, -greens * 35 - (ex.emotion === "hopeful" ? 40 : 0));
  const foundation = 0;

  const total = Math.min(
    1000,
    Math.max(0, plot + emotional + financial + family + communication + love_bonus + foundation),
  );
  return {
    total,
    subscores: { plot_twists: plot, emotional, financial, family, communication, love_bonus, foundation },
  };
}

export const computeChaosScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ draftId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;
    const { data: row, error: loadErr } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !row) throw new Error(loadErr?.message ?? "Draft not found");
    const draft = row as unknown as SpillDraftRow;

    const { total, subscores } = calcScoreFromSignals(draft.extracted ?? {});
    const band = bandForScore(total);

    // Compute simple rankings off the published posts table.
    let rankings: { city?: number; country?: number; world?: number } = {};
    try {
      const { count: worldHigher } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gt("score", total);
      if (typeof worldHigher === "number") {
        rankings = { world: worldHigher + 1 };
      }
    } catch {
      /* non-fatal */
    }

    const { data: updated, error } = await supabase
      .from("tea_drafts")
      .update({
        status: "drafting",
        score: total,
        subscores: subscores as never,
        category: band.label,
        category_key: band.key,
        rankings: rankings as never,
      })
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { draft: updated as unknown as SpillDraftRow };
  });

// ---------- generateThreeTones ----------

const variantSchema = z.object({
  tone: z.enum(["funny", "honest", "petty"]),
  title: z.string().min(4).max(160),
  story: z.string().min(20).max(600),
  hashtags: z.array(z.string().max(40)).max(8).default([]),
  badges: z.array(z.string().max(60)).max(5).default([]),
});
const variantsSchema = z.object({ variants: z.array(variantSchema).length(3) });

export const generateThreeTones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ draftId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;
    const { data: row, error: loadErr } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !row) throw new Error(loadErr?.message ?? "Draft not found");
    const draft = row as unknown as SpillDraftRow;

    const transcript = chatToTranscript(draft.chat_messages ?? []);
    const ex = draft.extracted ?? {};

    // The user's own words — both the initial dump and everything they typed
    // in chat. This is what the AI must preserve ~80% verbatim in the story body.
    const userVerbatim = [
      (draft.raw_dump ?? "").trim(),
      ...(draft.chat_messages ?? [])
        .filter((m) => m.role === "user")
        .map((m) => m.text.trim())
        .filter(Boolean),
    ].filter(Boolean).join("\n\n");

    const prompt = `Locale: ${draft.locale}
Chaos score: ${draft.score ?? "?"} / 1000 (${draft.category ?? ""})
Relationship type: ${ex.relationship_type ?? "unknown"}
Themes: ${(ex.themes ?? []).join(", ") || "(none)"}
Red flags: ${(ex.red_flags ?? []).join(", ") || "(none)"}
Green flags: ${(ex.green_flags ?? []).join(", ") || "(none)"}
Emotion: ${ex.emotion ?? "unknown"}, intensity: ${ex.intensity ?? "?"}

USER'S OWN WORDS (this IS the story body — keep ~80% verbatim, only redact PII + light cleanup):
"""
${userVerbatim || "(user gave very little — lean on transcript context)"}
"""

FULL TRANSCRIPT (context only — do NOT copy AI lines into the story):
${transcript}

${SPILL_THREE_TONES_PROMPT}`;

    const raw = await callGatewayJSON<unknown>({
      messages: [
        { role: "system", content: SPILL_PERSONA },
        { role: "user", content: prompt },
      ],
      temperature: 0.95,
    });
    const parsed = variantsSchema.parse(raw);
    const variants: ToneVariant[] = parsed.variants;

    const { data: updated, error } = await supabase
      .from("tea_drafts")
      .update({ draft_variants: variants as never })
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { draft: updated as unknown as SpillDraftRow };
  });

// ---------- selectVariant ----------

export const selectVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draftId: z.string().uuid(),
        tone: z.enum(["funny", "honest", "petty"]),
        title: z.string().min(4).max(160),
        story: z.string().min(20).max(600),
        coverUrl: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ draft: SpillDraftRow }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tea_drafts")
      .update({
        selected_tone: data.tone,
        selected_title: data.title,
        selected_story: data.story,
        cover_url: data.coverUrl ?? null,
        cover_kind: data.coverUrl ? "user" : null,
        status: "previewing",
      })
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { draft: row as unknown as SpillDraftRow };
  });

// ---------- publishTea ----------

export const publishTea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ draftId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ postId: string }> => {
    const { supabase, userId } = context;
    const { data: row, error: loadErr } = await supabase
      .from("tea_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !row) throw new Error(loadErr?.message ?? "Draft not found");
    const draft = row as unknown as SpillDraftRow;

    if (!draft.selected_title || !draft.selected_story || !draft.selected_tone) {
      throw new Error("Pick a draft variant before publishing.");
    }
    const variant = (draft.draft_variants ?? []).find((v) => v.tone === draft.selected_tone);
    const hashtags = variant?.hashtags ?? [];
    const badges = variant?.badges ?? [];
    const score = draft.score ?? 0;
    const tone =
      draft.selected_tone === "petty" ? "chaotic" : draft.selected_tone === "honest" ? "serious" : "funny";

    const { data: post, error: insErr } = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        status: "published",
        published_at: nowIso(),
        title: draft.selected_title,
        story_text: draft.selected_story,
        tone,
        badges,
        hashtags,
        media_url: draft.cover_url,
        platform_captions: {} as never,
        locale: draft.locale,
        score,
        score_category: draft.category ?? scoreCategoryLabel(score),
      })
      .select("id")
      .single();
    if (insErr || !post) throw new Error(insErr?.message ?? "Failed to publish");

    await supabase
      .from("tea_drafts")
      .update({ status: "published", final_post_id: post.id })
      .eq("id", data.draftId)
      .eq("user_id", userId);

    return { postId: post.id };
  });

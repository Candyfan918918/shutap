// Authoring pipeline: AI draft generation, create/update drafts, approve & publish.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGatewayJSON } from "@/lib/ai/gateway";
import { scoreCategoryLabel } from "@/lib/posts/types";
import type { DraftPayload, PostRecord, PlatformCaptions } from "@/lib/posts/types";

// ---------- Schemas ----------

const scoreContextSchema = z.object({
  score: z.number().min(0).max(1000),
  category: z.string().max(80).optional(),
  subscores: z.record(z.string(), z.number()).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  locale: z.string().min(2).max(8).default("en"),
  raw_answers: z.string().max(2000).optional(),
});

const toneSchema = z.enum(["funny", "serious", "chaotic", "soft"]);

const draftSchema = z.object({
  title: z.string().min(4).max(160),
  story: z.string().min(20).max(600),
  badges: z.array(z.string().max(40)).min(1).max(5),
  hashtags: z.array(z.string().max(40)).max(8).default([]),
  platform_captions: z
    .object({
      x: z.string().max(280).optional(),
      tiktok: z.string().max(300).optional(),
      instagram: z.string().max(600).optional(),
      xiaohongshu: z.string().max(1000).optional(),
      facebook: z.string().max(600).optional(),
      imessage: z.string().max(200).optional(),
      whatsapp: z.string().max(300).optional(),
    })
    .partial()
    .default({}),
});

// ---------- generateStoryDraft ----------

export const generateStoryDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scoreContext: scoreContextSchema,
        tone: toneSchema.default("funny"),
        seed: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<DraftPayload> => {
    const { scoreContext, tone } = data;
    const category = scoreContext.category || scoreCategoryLabel(scoreContext.score);
    const locale = scoreContext.locale || "en";

    const system = [
      "You are the witty, empathetic editor of 'Shutap', an anonymous relationship storytelling community.",
      "You write SHORT, viral-style relationship story posts. Tone is warm, slightly dark-humored, never judgmental.",
      "NEVER include PII (real names, addresses, phone numbers).",
      "Output STRICT JSON only — no prose, no markdown fences.",
      `Write in locale: ${locale} (use the user's native language).`,
    ].join(" ");

    const user = `Generate a Shutap post draft.

Score: ${scoreContext.score} / 1000
Category: ${category}
Tone: ${tone}
Tags: ${(scoreContext.tags ?? []).join(", ") || "(none)"}
Subscores: ${JSON.stringify(scoreContext.subscores ?? {})}
Raw notes: ${scoreContext.raw_answers ?? "(none)"}

Return a JSON object shaped exactly:
{
  "title": "viral hook, max 80 chars, hooky like 'My relationship scored higher chaos than 92% of California'",
  "story": "60-180 chars, memeable, emotionally intelligent, slight humor",
  "badges": ["2-3 punchy badges like 'Plot Twist: High', 'Emotional Damage Detected', 'Still Somehow Together™'"],
  "hashtags": ["3-5 locale-appropriate hashtags, lowercase, no #"],
  "platform_captions": {
    "x": "short emotional hook + score. Max 240 chars. Include 1-2 hashtags.",
    "tiktok": "Hook starting 'watch this if...' style. 1-2 lines.",
    "instagram": "Aesthetic emotional caption. 2-3 short paragraphs.",
    "xiaohongshu": "Long-form relatable storytelling. Use Chinese internet style if locale=zh.",
    "facebook": "Conversational, 1 paragraph.",
    "imessage": "Casual one-line funny summary.",
    "whatsapp": "Casual one-liner with emoji."
  }
}`;

    const raw = await callGatewayJSON<DraftPayload>({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.95,
    });

    // Validate / coerce
    const parsed = draftSchema.parse(raw);
    return parsed;
  });

// ---------- createDraftPost ----------

export const createDraftPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storyId: z.string().uuid().optional(),
        draft: draftSchema,
        tone: toneSchema.default("funny"),
        locale: z.string().min(2).max(8).default("en"),
        score: z.number().min(0).max(1000),
        scoreCategory: z.string().max(80).optional(),
        mediaUrl: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ post: PostRecord }> => {
    const { supabase, userId } = context;
    const scrubbedTitle = scrubPII(data.draft.title);
    const scrubbedStory = scrubPII(data.draft.story);
    const piiRemoved = scrubbedTitle.piiRemoved || scrubbedStory.piiRemoved;
    const { error, data: row } = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        story_id: data.storyId ?? null,
        status: "draft",
        title: scrubbedTitle.text,
        story_text: scrubbedStory.text,
        tone: data.tone,
        badges: data.draft.badges,
        hashtags: data.draft.hashtags,
        media_url: data.mediaUrl ?? null,
        platform_captions: data.draft.platform_captions as PlatformCaptions,
        locale: data.locale,
        score: data.score,
        score_category: data.scoreCategory ?? scoreCategoryLabel(data.score),
        pii_removed: piiRemoved,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { post: row as unknown as PostRecord };
  });

// ---------- updateDraftPost ----------

export const updateDraftPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        patch: z
          .object({
            title: z.string().min(4).max(160).optional(),
            story_text: z.string().min(20).max(600).optional(),
            tone: toneSchema.optional(),
            badges: z.array(z.string().max(40)).max(5).optional(),
            hashtags: z.array(z.string().max(40)).max(8).optional(),
            media_url: z.string().url().nullable().optional(),
            platform_captions: z.record(z.string(), z.string()).optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, data: row } = await supabase
      .from("posts")
      .update(data.patch)
      .eq("id", data.postId)
      .eq("author_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { post: row as unknown as PostRecord };
  });

// ---------- approveAndPublish ----------

export const approveAndPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ post: PostRecord; url: string }> => {
    const { supabase, userId } = context;

    // Get current post for snapshot
    const { data: current, error: getErr } = await supabase
      .from("posts")
      .select("*")
      .eq("id", data.postId)
      .eq("author_id", userId)
      .single();
    if (getErr || !current) throw new Error(getErr?.message ?? "Post not found");

    const { error: updErr, data: published } = await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("author_id", userId)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);

    // Audit approval (best-effort)
    await supabase.from("post_approvals").insert({
      post_id: data.postId,
      user_id: userId,
      version_snapshot: current as never,
    });

    return {
      post: published as unknown as PostRecord,
      url: `/post/${data.postId}`,
    };
  });

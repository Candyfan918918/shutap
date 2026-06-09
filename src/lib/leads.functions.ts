// Lead broker — gates on crisis_signal, writes consent first then lead row.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";

const InputSchema = z.object({
  story_id: z.string().uuid(),
  service_category: z.string().min(1),
  consent_given: z.literal(true),
});

const CRISIS_RESOURCES = [
  { name: "Crisis Text Line", contact: "Text HOME to 741741", country: "US/UK/CA/IE" },
  { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", country: "US" },
  { name: "Samaritans", contact: "116 123", country: "UK/IE" },
];

export type LeadResult = {
  data:
    | { crisis: true; resources: typeof CRISIS_RESOURCES }
    | { crisis: false; lead_id: string; consent_id: string }
    | null;
  error: string | null;
};

export const brokerLead = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<LeadResult> => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull tags in parallel.
    const [{ data: storyTags }, { data: userTags }] = await Promise.all([
      supabaseAdmin.from("story_tags").select("tag").eq("story_id", data.story_id),
      supabaseAdmin.from("user_tags").select("tag").eq("user_id", ctx.userId),
    ]);

    const tagSet = new Set([
      ...(storyTags ?? []).map((t: any) => t.tag),
      ...(userTags ?? []).map((t: any) => t.tag),
    ]);

    if (tagSet.has("crisis_signal")) {
      return { data: { crisis: true, resources: CRISIS_RESOURCES }, error: null };
    }

    // Consent row first (FK enforced).
    const { data: consentRow, error: consentErr } = await supabaseAdmin
      .from("consent")
      .insert({
        user_id: ctx.userId,
        story_id: data.story_id,
        service_category: data.service_category,
      })
      .select("id")
      .single();

    if (consentErr || !consentRow) {
      return { data: null, error: consentErr?.message ?? "consent_insert_failed" };
    }

    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert({
        user_id: ctx.userId,
        story_id: data.story_id,
        case_type: data.service_category,
        contact: {},
        status: "new",
        consent_id: consentRow.id,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return { data: null, error: leadErr?.message ?? "lead_insert_failed" };
    }

    return {
      data: { crisis: false, lead_id: leadRow.id, consent_id: consentRow.id },
      error: null,
    };
  });

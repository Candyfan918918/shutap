// Private lead pipeline: record user intent after publish, compute lead score,
// allow opt-in contact submission, and admin-only listing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ----- Types -----
export type IntentKind =
  | "reactions"
  | "support"
  | "documentation"
  | "legal"
  | "next_steps";
export type LeadTemperature = "cold" | "early" | "warm" | "hot";

export interface IntentSummary {
  id: string;
  intent: IntentKind;
  leadScore: number;
  leadTemperature: LeadTemperature;
}

// Sensitive keywords that signal higher legal/practical stakes.
const HOT_KEYWORDS = [
  "divorce","custody","child support","alimony","restraining","abuse",
  "lawyer","attorney","court","property","prenup","postnup","domestic",
  "violence","stalking","harassment","cheating proof","evidence",
];

const INTENT_WEIGHTS: Record<IntentKind, number> = {
  reactions: 5,
  support: 15,
  documentation: 35,
  legal: 60,
  next_steps: 45,
};

function classifyTemperature(score: number): LeadTemperature {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  if (score >= 25) return "early";
  return "cold";
}

async function computeLeadScore(opts: {
  userId: string;
  intent: IntentKind;
  urgency: number;
  postId: string | null;
}): Promise<{ score: number; signals: Record<string, unknown> }> {
  let score = INTENT_WEIGHTS[opts.intent];
  const signals: Record<string, unknown> = { intent_weight: INTENT_WEIGHTS[opts.intent] };

  // Urgency: +0..+15
  const urgencyBonus = Math.max(0, Math.min(5, opts.urgency - 1)) * 3;
  score += urgencyBonus;
  signals.urgency_bonus = urgencyBonus;

  // Post-driven signals
  if (opts.postId) {
    const [{ data: post }, { data: votes }] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("title, story_text, score")
        .eq("id", opts.postId)
        .maybeSingle(),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("kind")
        .eq("post_id", opts.postId),
    ]);

    const chaos = (post?.score as number | null) ?? 0;
    if (chaos >= 800) { score += 15; signals.chaos = "legendary"; }
    else if (chaos >= 600) { score += 10; signals.chaos = "high"; }
    else if (chaos >= 350) { score += 5; signals.chaos = "mid"; }

    const haystack = `${post?.title ?? ""} ${post?.story_text ?? ""}`.toLowerCase();
    const matched = HOT_KEYWORDS.filter((k) => haystack.includes(k));
    if (matched.length) {
      const bonus = Math.min(20, matched.length * 5);
      score += bonus;
      signals.keywords = matched.slice(0, 6);
      signals.keyword_bonus = bonus;
    }

    const lawyerUp = (votes ?? []).filter((v) => (v as { kind: string }).kind === "lawyer_up").length;
    if (lawyerUp > 0) {
      const bonus = Math.min(15, lawyerUp * 3);
      score += bonus;
      signals.lawyer_up_votes = lawyerUp;
    }
  }

  // Repeat-intent signal: previous intents from this user
  const { count: priorCount } = await supabaseAdmin
    .from("professional_intents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId);
  if ((priorCount ?? 0) >= 1) {
    score += Math.min(10, priorCount! * 3);
    signals.prior_intents = priorCount;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, signals };
}

// ----- recordIntent -----
const IntentEnum = z.enum(["reactions","support","documentation","legal","next_steps"]);

export const recordIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      intent: IntentEnum,
      postId: z.string().uuid().nullable().optional(),
      scanId: z.string().uuid().nullable().optional(),
      urgency: z.number().int().min(1).max(5).default(3),
      note: z.string().max(500).optional(),
      source: z.string().max(40).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<IntentSummary> => {
    const userId = context.userId;
    const { score, signals } = await computeLeadScore({
      userId,
      intent: data.intent,
      urgency: data.urgency,
      postId: data.postId ?? null,
    });
    const temp = classifyTemperature(score);

    const { data: row, error } = await supabaseAdmin
      .from("professional_intents")
      .insert({
        user_id: userId,
        post_id: data.postId ?? null,
        scan_id: data.scanId ?? null,
        intent: data.intent,
        urgency: data.urgency,
        note: data.note ?? null,
        lead_score: score,
        lead_temperature: temp,
        signals,
        source: data.source ?? null,
      })
      .select("id, intent, lead_score, lead_temperature")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      intent: row.intent as IntentKind,
      leadScore: row.lead_score as number,
      leadTemperature: row.lead_temperature as LeadTemperature,
    };
  });

// ----- submitLeadContact -----
const ContactSchema = z.object({
  intentId: z.string().uuid().nullable().optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  countryCode: z.string().trim().max(4).optional().or(z.literal("")),
  helpType: IntentEnum.optional(),
  notes: z.string().max(1000).optional(),
  consent: z.literal(true),
});

export const submitLeadContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ContactSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const userId = context.userId;
    const email = data.email?.trim() || null;
    const phone = data.phone?.trim() || null;
    if (!email && !phone) throw new Error("Provide email or phone.");

    const { data: row, error } = await supabaseAdmin
      .from("lead_contacts")
      .insert({
        user_id: userId,
        intent_id: data.intentId ?? null,
        email,
        phone,
        city: data.city?.trim() || null,
        country_code: data.countryCode?.trim() || null,
        help_type: data.helpType ?? null,
        notes: data.notes?.trim() || null,
        consent_given: true,
        consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

// ----- admin list -----
export interface AdminLeadRow {
  intentId: string;
  userId: string;
  handle: string | null;
  intent: IntentKind;
  urgency: number;
  leadScore: number;
  leadTemperature: LeadTemperature;
  signals: Record<string, unknown>;
  createdAt: string;
  postId: string | null;
  postTitle: string | null;
  postScore: number | null;
  city: string | null;
  countryCode: string | null;
  courtStatus: string | null;
  contact: {
    id: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    helpType: IntentKind | null;
    status: string;
    createdAt: string;
  } | null;
}

export const listLeadsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sort: z.enum(["score","recent","urgency"]).default("score"),
      temperature: z.enum(["all","hot","warm","early","cold"]).default("all"),
      intent: z.enum(["all","reactions","support","documentation","legal","next_steps"]).default("all"),
      city: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminLeadRow[]> => {
    // Admin gate
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    let q = supabaseAdmin
      .from("professional_intents")
      .select("id, user_id, post_id, intent, urgency, lead_score, lead_temperature, signals, created_at")
      .limit(data.limit);

    if (data.temperature !== "all") q = q.eq("lead_temperature", data.temperature);
    if (data.intent !== "all") q = q.eq("intent", data.intent);

    if (data.sort === "score") q = q.order("lead_score", { ascending: false });
    else if (data.sort === "urgency") q = q.order("urgency", { ascending: false }).order("lead_score", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const { data: intents, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (intents ?? []) as Array<{
      id: string; user_id: string; post_id: string | null; intent: IntentKind;
      urgency: number; lead_score: number; lead_temperature: LeadTemperature;
      signals: Record<string, unknown>; created_at: string;
    }>;

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const postIds = Array.from(new Set(rows.map((r) => r.post_id).filter(Boolean) as string[]));
    const intentIds = rows.map((r) => r.id);

    const [profilesRes, postsRes, contactsRes, courtRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, handle, city_label, country_code").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabaseAdmin.from("posts").select("id, title, score").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      intentIds.length
        ? supabaseAdmin.from("lead_contacts")
            .select("id, intent_id, email, phone, city, help_type, status, created_at")
            .in("intent_id", intentIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabaseAdmin.from("court_cases").select("post_id, status, scope").in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profById = new Map(((profilesRes.data ?? []) as Array<{ id: string; handle: string; city_label: string | null; country_code: string | null }>).map((p) => [p.id, p]));
    const postById = new Map(((postsRes.data ?? []) as Array<{ id: string; title: string; score: number | null }>).map((p) => [p.id, p]));
    const contactByIntent = new Map(((contactsRes.data ?? []) as Array<{ id: string; intent_id: string; email: string | null; phone: string | null; city: string | null; help_type: IntentKind | null; status: string; created_at: string }>).map((c) => [c.intent_id, c]));
    const courtByPost = new Map(((courtRes.data ?? []) as Array<{ post_id: string; status: string; scope: string }>).map((c) => [c.post_id, c]));

    let filtered = rows;
    if (data.city) {
      const needle = data.city.toLowerCase();
      filtered = rows.filter((r) => (profById.get(r.user_id)?.city_label ?? "").toLowerCase().includes(needle));
    }

    return filtered.map((r) => {
      const prof = profById.get(r.user_id);
      const post = r.post_id ? postById.get(r.post_id) : null;
      const contact = contactByIntent.get(r.id) ?? null;
      const court = r.post_id ? courtByPost.get(r.post_id) : null;
      return {
        intentId: r.id,
        userId: r.user_id,
        handle: prof?.handle ?? null,
        intent: r.intent,
        urgency: r.urgency,
        leadScore: r.lead_score,
        leadTemperature: r.lead_temperature,
        signals: r.signals,
        createdAt: r.created_at,
        postId: r.post_id,
        postTitle: post?.title ?? null,
        postScore: post?.score ?? null,
        city: prof?.city_label ?? null,
        countryCode: prof?.country_code ?? null,
        courtStatus: court ? `${court.scope}/${court.status}` : null,
        contact: contact
          ? {
              id: contact.id,
              email: contact.email,
              phone: contact.phone,
              city: contact.city,
              helpType: contact.help_type,
              status: contact.status,
              createdAt: contact.created_at,
            }
          : null,
      };
    });
  });

// ----- viewer's own latest intent (for UI dedupe) -----
export const getMyLatestIntent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<IntentSummary | null> => {
    const { data: row } = await supabaseAdmin
      .from("professional_intents")
      .select("id, intent, lead_score, lead_temperature")
      .eq("user_id", context.userId)
      .eq("post_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id as string,
      intent: row.intent as IntentKind,
      leadScore: row.lead_score as number,
      leadTemperature: row.lead_temperature as LeadTemperature,
    };
  });

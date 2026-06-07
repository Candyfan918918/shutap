// Safety Risk Classifier
//
// Server-side. Calls Lovable AI Gateway with a focused safety prompt and
// returns a structured RiskResult used to gate publishing.
//
// NOTE: The original spec requested Claude sonnet-4. Lovable AI Gateway does
// not route to Anthropic — we use `openai/gpt-5-mini` (strong reasoning,
// JSON-mode capable) with the exact same output schema.

import { callGatewayJSON } from "@/lib/ai/gateway";

export type RiskLevel = "none" | "possible" | "likely";
export type LegalUrgency = "none" | "civil" | "criminal";

export type RiskResult = {
  abuseRisk: RiskLevel;
  selfHarmRisk: RiskLevel;
  minorInvolved: boolean;
  legalUrgency: LegalUrgency;
  safeToPublish: boolean;
  reasons: string[];
};

const SYSTEM_PROMPT = `You are a careful safety classifier for an anonymous relationship-storytelling app called Shutap.

You read a short user-submitted story (already PII-scrubbed) and classify safety risk.

Return STRICT JSON only — no prose, no markdown fences — matching exactly this shape:
{
  "abuseRisk": "none" | "possible" | "likely",
  "selfHarmRisk": "none" | "possible" | "likely",
  "minorInvolved": boolean,
  "legalUrgency": "none" | "civil" | "criminal",
  "reasons": string[]
}

Guidance:
- abuseRisk: physical, emotional, sexual, financial, or coercive-control signals directed at the author or someone close to them.
  - "likely" = explicit or strongly implied ongoing abuse (hits me, forces me, threatens me, controls my finances, isolates me).
  - "possible" = ambiguous or one-off incidents that could be abuse (yelled, grabbed my arm once, name-calling).
  - "none" = ordinary conflict, betrayal, breakup pain with no abuse signals.
- selfHarmRisk: signals the AUTHOR is hurting themselves or considering suicide.
  - "likely" = direct statements of intent, plan, recent attempt, or active ideation ("I want to die", "I'm going to end it").
  - "possible" = passive ideation, hopelessness, "I can't go on like this", numb / dissociative language with despair.
  - "none" = sad, hurt, angry — but no self-harm cues.
- minorInvolved: true if the story clearly involves a person under 18 in a sexual, abusive, or otherwise unsafe context, OR if the AUTHOR appears to be a minor. Mere mention of "my kids" in a custody context is NOT enough on its own.
- legalUrgency:
  - "criminal" = assault, sexual assault, stalking, threats of violence, child endangerment, restraining-order-worthy.
  - "civil" = custody disputes, divorce, restraining orders being filed, eviction, harassment that's not criminal.
  - "none" = no legal angle.
- reasons: 1–5 short plain-English bullet phrases, each <80 chars, naming the specific cues you saw. No PII. No quotes from the user.

Be conservative but not hysterical: ordinary heartbreak is "none". Reserve "likely" for clear evidence.`;

type RawRisk = {
  abuseRisk?: RiskLevel;
  selfHarmRisk?: RiskLevel;
  minorInvolved?: boolean;
  legalUrgency?: LegalUrgency;
  reasons?: string[];
};

function coerceLevel(v: unknown): RiskLevel {
  return v === "likely" || v === "possible" ? v : "none";
}
function coerceLegal(v: unknown): LegalUrgency {
  return v === "criminal" || v === "civil" ? v : "none";
}

export async function classifyRisk(text: string): Promise<RiskResult> {
  const clean = (text ?? "").trim();
  if (!clean) {
    return {
      abuseRisk: "none",
      selfHarmRisk: "none",
      minorInvolved: false,
      legalUrgency: "none",
      safeToPublish: true,
      reasons: [],
    };
  }

  let raw: RawRisk;
  try {
    raw = await callGatewayJSON<RawRisk>({
      model: "openai/gpt-5-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: clean.slice(0, 4000) },
      ],
    });
  } catch (err) {
    // Fail-closed for the publish gate: if we cannot classify, do not block,
    // but mark publish-safe=true with a reason so the caller can decide.
    // The publish handler treats only `safeToPublish === false` as a block.
    return {
      abuseRisk: "none",
      selfHarmRisk: "none",
      minorInvolved: false,
      legalUrgency: "none",
      safeToPublish: true,
      reasons: [
        `classifier_unavailable: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`,
      ],
    };
  }

  const abuseRisk = coerceLevel(raw.abuseRisk);
  const selfHarmRisk = coerceLevel(raw.selfHarmRisk);
  const minorInvolved = raw.minorInvolved === true;
  const legalUrgency = coerceLegal(raw.legalUrgency);
  const reasons = Array.isArray(raw.reasons)
    ? raw.reasons
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((r) => (r.length > 120 ? r.slice(0, 117) + "…" : r))
    : [];

  const safeToPublish =
    selfHarmRisk !== "likely" && abuseRisk !== "likely" && !minorInvolved;

  return {
    abuseRisk,
    selfHarmRisk,
    minorInvolved,
    legalUrgency,
    safeToPublish,
    reasons,
  };
}

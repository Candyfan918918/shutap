// Orchestrator — sequences AI agents per moment.
// Server-only. Never imported by client code; only invoked from server fns.
//
// Contract:
// - Every agent runs with AGENT_PROMPTS[agent] as system prompt, claude-sonnet
//   via the Lovable AI Gateway.
// - Every call is logged to ai_call_log via the service-role admin client.
// - PRIVATE_AGENTS (tagger, guardian, privacy_shield, lead_qualifier) outputs
//   are kept in pipeline context AND persisted, but stripped from the result
//   returned to the caller — they must never reach the browser.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGatewayJSON } from "@/lib/ai/gateway";
import {
  AGENT_PROMPTS,
  PRIVATE_AGENTS,
  modelFor,
  type AgentName,
} from "@/lib/agent-prompts.server";

export type Moment =
  | "spill"
  | "scan"
  | "compose"
  | "court_verdict"
  | "court_verdict_lock"
  | "outcome"
  | "chatbot"
  | "hof_update"
  | "reputation"
  | "wisdom_graph"
  | "admin_triage"
  | "admin_briefing"
  | "standing_verify";


const MOMENT_AGENTS: Record<Moment, AgentName[]> = {
  // Spill: ask → check identifying detail → screen for harm → tag the situation.
  spill: ["spill_copilot", "privacy_shield", "guardian", "tagger"],
  // Scan: tag the situation, then decide if a service card should surface.
  scan: ["tagger", "lead_qualifier"],
  // Compose: one agent picks the stream order.
  compose: ["composer"],
  // Court verdict: format the case + speak the Bench line.
  court_verdict: ["case_formatter", "the_bench"],
  // Court lock: write the sealed one-line verdict for a just-locked case.
  court_verdict_lock: ["bench_verdict_writer"],
  // Outcome reveal: Bench narration only.
  outcome: ["the_bench"],
  // Chatbot: single router agent owns intent + response text.
  chatbot: ["chatbot_agent"],
  // HOF score recompute.
  hof_update: ["hof_scoring_agent"],
  // Reputation recompute (justice/wisdom/empathy/prediction + title).
  reputation: ["reputation_engine"],
  // Wisdom graph node + edges after a case resolves.
  wisdom_graph: ["wisdom_graph_writer"],
  // Admin moderation triage.
  admin_triage: ["admin_triage"],
  // Admin daily briefing.
  admin_briefing: ["admin_briefing"],
  // Standing verification: judge first, then scrub any identifying detail from claimed facts.
  standing_verify: ["standing_judge", "privacy_shield"],
};


export interface OrchestratorInput {
  moment: Moment;
  payload: Record<string, unknown>;
  userId: string;
  storyId?: string;
}

export interface AgentResult {
  agent: AgentName;
  output: unknown;
  latency_ms: number;
}

export interface OrchestratorResult {
  /** Public outputs only — PRIVATE_AGENTS are filtered out. */
  results: AgentResult[];
}

async function logCall(
  userId: string,
  agent: AgentName,
  model: string,
  moment: Moment,
  storyId: string | undefined,
  latency_ms: number,
  status: "ok" | "error",
  error?: string,
) {
  try {
    await supabaseAdmin.from("ai_call_log").insert({
      user_id: userId,
      story_id: storyId ?? null,
      agent,
      moment,
      model,
      latency_ms,
      status,
      error: error ?? null,
    });
  } catch {
    // Never let logging take down a request.
  }
}

export async function runMoment(input: OrchestratorInput): Promise<OrchestratorResult> {
  const agents = MOMENT_AGENTS[input.moment];
  const publicResults: AgentResult[] = [];

  // The full pipeline context — includes private agent outputs so downstream
  // agents can reason over tags / safety flags. Never returned to the caller.
  let context: Record<string, unknown> = { ...input.payload };

  for (const agent of agents) {
    const model = modelFor(agent);
    const started = Date.now();
    try {
      const output = await callGatewayJSON<unknown>({
        model,
        messages: [
          { role: "system", content: AGENT_PROMPTS[agent] },
          {
            role: "user",
            content: JSON.stringify({ moment: input.moment, context }),
          },
        ],
      });
      const latency_ms = Date.now() - started;
      await logCall(
        input.userId,
        agent,
        model,
        input.moment,
        input.storyId,
        latency_ms,
        "ok",
      );
      // Feed prior output into the next agent's context regardless of privacy.
      context = { ...context, [`${agent}_output`]: output };
      // Only public agent outputs are surfaced to the caller.
      if (!PRIVATE_AGENTS.has(agent)) {
        publicResults.push({ agent, output, latency_ms });
      }
    } catch (e) {
      const latency_ms = Date.now() - started;
      const msg = (e as Error)?.message ?? "unknown";
      await logCall(
        input.userId,
        agent,
        model,
        input.moment,
        input.storyId,
        latency_ms,
        "error",
        msg,
      );
      throw e;
    }
  }

  return { results: publicResults };
}

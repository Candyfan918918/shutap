// Orchestrator — sequences AI agents per moment.
// Server-only. Never called directly by client; invoked from server fns.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGatewayJSON } from "@/lib/ai/gateway";
import { AGENT_PROMPTS, modelFor, type AgentName } from "@/lib/agent-prompts.server";

export type Moment =
  | "spill"
  | "scan"
  | "compose"
  | "court_verdict"
  | "outcome"
  | "chatbot"
  | "hof_update"
  | "admin_triage"
  | "admin_briefing";

const MOMENT_AGENTS: Record<Moment, AgentName[]> = {
  spill: ["spill_questioner"],
  scan: ["scan_questioner", "scan_scorer", "scan_tagger", "scan_lead_qualifier"],
  compose: ["composer"],
  court_verdict: ["court_summarizer"],
  outcome: ["outcome_prompt"],
  chatbot: ["chatbot_router"],
  hof_update: ["hof_scorer"],
  admin_triage: ["admin_triage"],
  admin_briefing: ["admin_briefing"],
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
  const results: AgentResult[] = [];

  let context: Record<string, unknown> = { ...input.payload };

  for (const agent of agents) {
    const model = modelFor(agent);
    const started = Date.now();
    try {
      const output = await callGatewayJSON<unknown>({
        model,
        messages: [
          { role: "system", content: AGENT_PROMPTS[agent] },
          { role: "user", content: JSON.stringify({ moment: input.moment, context }) },
        ],
      });
      const latency_ms = Date.now() - started;
      await logCall(input.userId, agent, model, input.moment, input.storyId, latency_ms, "ok");
      results.push({ agent, output, latency_ms });
      // Feed prior agent output into the next agent's context.
      context = { ...context, [`${agent}_output`]: output };
    } catch (e) {
      const latency_ms = Date.now() - started;
      const msg = (e as Error)?.message ?? "unknown";
      await logCall(input.userId, agent, model, input.moment, input.storyId, latency_ms, "error", msg);
      throw e;
    }
  }

  return { results };
}

// Single broker for AI agent calls.
// Spec: rate-limit Spill 20/day, Scan 100/day; log every call; age-gate enforced.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";

const InputSchema = z.object({
  agent: z.string().min(1),
  context: z.record(z.string(), z.unknown()).default({}),
  story_id: z.string().uuid().optional(),
});

export type AiBrokerResult<T = unknown> = {
  data: { content: T } | null;
  error: string | null;
};

export const callAgent = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiBrokerResult> => {
    const ctx = context as { userId: string };

    // Defer heavy server-only imports so this module stays
    // client-bundle-safe per tanstack-supabase-import-graph.
    const [{ checkAndIncrement }, { runMoment }, { AGENT_PROMPTS }] = await Promise.all([
      import("@/lib/rate-limit.server"),
      import("@/lib/orchestrator.server"),
      import("@/lib/agent-prompts.server"),
    ]);

    // Map agent name → bucket for rate limiting.
    const bucket = data.agent.startsWith("spill_")
      ? ("spill" as const)
      : data.agent.startsWith("scan_")
        ? ("scan" as const)
        : data.agent.startsWith("chatbot_")
          ? ("chatbot" as const)
          : ("ai_generic" as const);

    const rl = await checkAndIncrement(ctx.userId, bucket);
    if (!rl.ok) {
      return { data: null, error: `rate_limited:${bucket}:${rl.limit}/day` };
    }

    if (!(data.agent in AGENT_PROMPTS)) {
      return { data: null, error: `unknown_agent:${data.agent}` };
    }

    try {
      const result = await runMoment({
        moment: "compose",
        payload: { agent: data.agent, ...data.context },
        userId: ctx.userId,
        storyId: data.story_id,
      });
      return { data: { content: result.results[0]?.output ?? null }, error: null };
    } catch (e) {
      return { data: null, error: (e as Error)?.message ?? "ai_call_failed" };
    }
  });

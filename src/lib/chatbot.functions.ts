// Chatbot — Bench-voice assistant with structured query execution.
// The chatbot agent emits a query_spec (NOT raw SQL); we run it via
// supabaseAdmin with a column allowlist.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAgeVerified } from "@/lib/middleware/require-age-verified";

const InputSchema = z.object({
  message: z.string().min(1).max(2000),
});

// Allowlist of tables the chatbot may query, with allowed columns.
const QUERY_ALLOWLIST: Record<string, readonly string[]> = {
  stories: ["id", "title", "story_text", "score", "published_at", "author_id"],
  posts: ["id", "title", "body", "published_at", "author_id", "like_count", "comment_count"],
  court_cases: ["id", "post_id", "scope", "region_label", "status", "final_verdict"],
  hof_scores: ["entity_type", "entity_id", "period", "score"],
  story_tags: ["story_id", "tag", "confidence"],
};

interface QuerySpec {
  table?: string;
  columns?: string[];
  filters?: Record<string, string | number | boolean>;
  limit?: number;
  order_by?: string;
}

// stream_override is serialized as a JSON string so any shape passes the
// strict TanStack Start serializability check.
export type ChatbotResult = {
  data: {
    response_text: string;
    stream_override_json: string | null;
  } | null;
  error: string | null;
};

export const chat = createServerFn({ method: "POST" })
  .middleware([requireAgeVerified])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChatbotResult> => {
    const ctx = context as { supabase: any; userId: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runMoment } = await import("@/lib/orchestrator.server");

    const { data: tagRows } = await ctx.supabase
      .from("user_tags")
      .select("tag, confidence")
      .eq("user_id", ctx.userId);

    let agentOutput: any = null;
    try {
      const result = await runMoment({
        moment: "chatbot",
        payload: { message: data.message, user_tags: tagRows ?? [] },
        userId: ctx.userId,
      });
      agentOutput = result.results[0]?.output;
    } catch (e) {
      return { data: null, error: (e as Error)?.message ?? "chatbot_failed" };
    }

    const response_text: string = agentOutput?.response_text ?? "";
    const query_spec: QuerySpec | undefined = agentOutput?.query_spec;
    let stream_override: Array<Record<string, unknown>> | undefined =
      agentOutput?.stream_override;

    if (query_spec?.table && QUERY_ALLOWLIST[query_spec.table]) {
      const allowedCols = QUERY_ALLOWLIST[query_spec.table];
      const cols = (query_spec.columns ?? []).filter((c) => allowedCols.includes(c));
      const select = cols.length ? cols.join(",") : allowedCols.join(",");
      const admin = supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (s: string) => { eq: (k: string, v: unknown) => any; limit: (n: number) => any };
        };
      };
      let q: any = admin.from(query_spec.table).select(select);
      for (const [k, v] of Object.entries(query_spec.filters ?? {})) {
        if (allowedCols.includes(k)) q = q.eq(k, v);
      }
      const limit = Math.min(Math.max(query_spec.limit ?? 20, 1), 50);
      q = q.limit(limit);
      const { data: rows } = await q;
      if (rows && !stream_override) {
        stream_override = (rows as unknown[]).map((row) => ({
          type: "row",
          table: query_spec.table,
          row,
        }));
      }
    }

    return {
      data: {
        response_text,
        stream_override_json: stream_override ? JSON.stringify(stream_override) : null,
      },
      error: null,
    };
  });

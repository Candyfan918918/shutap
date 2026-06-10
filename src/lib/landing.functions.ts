// Landing page server fns — isolated from court.functions.ts.
import { createServerFn } from "@tanstack/react-start";

export const getGlobalVerdictTally = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ total: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("*", { count: "exact", head: true });
    return { total: count ?? 0 };
  },
);

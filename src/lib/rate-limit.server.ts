// DB-backed daily rate limiter. Service-role only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Bucket = "spill" | "scan" | "chatbot" | "ai_generic";

const DAILY_LIMITS: Record<Bucket, number> = {
  spill: 20,
  scan: 100,
  chatbot: 200,
  ai_generic: 500,
};

function dayWindow(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function checkAndIncrement(
  userId: string,
  bucket: Bucket,
): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const limit = DAILY_LIMITS[bucket];
  const window_start = dayWindow();

  const { data: existing } = await supabaseAdmin
    .from("rate_limit_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .eq("window_start", window_start)
    .maybeSingle();

  const current = existing?.count ?? 0;
  if (current >= limit) {
    return { ok: false, remaining: 0, limit };
  }

  await supabaseAdmin
    .from("rate_limit_counters")
    .upsert(
      { user_id: userId, bucket, window_start, count: current + 1 },
      { onConflict: "user_id,bucket,window_start" },
    );

  return { ok: true, remaining: limit - current - 1, limit };
}

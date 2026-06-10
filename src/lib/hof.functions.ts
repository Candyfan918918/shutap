// Hall of Fame engine — scores entities, snapshots periods, awards badges.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HOF_CATEGORIES,
  HOF_PERIODS,
  periodKeyFor,
  type HofEntityType,
  type HofPeriod,
} from "@/lib/hof-categories";

const EntityEnum = z.enum(["user", "story", "case"]);

// ---------- recordEvent (existing surface, extended w/ category) ----------
const RecordSchema = z.object({
  event_type: z.string().min(1),
  entity_type: EntityEnum,
  entity_id: z.string().uuid(),
  category: z.string().default("overall"),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export type HofResult = { data: { score: number; period: string } | null; error: string | null };

export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecordSchema.parse(input))
  .handler(async ({ data, context }): Promise<HofResult> => {
    const ctx = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runMoment } = await import("@/lib/orchestrator.server");

    let score = 0;
    let metrics: Record<string, unknown> = { ...data.metrics };
    try {
      const r = await runMoment({
        moment: "hof_update",
        payload: { ...data },
        userId: ctx.userId,
      });
      const output: any = r.results[0]?.output ?? {};
      if (typeof output.score === "number") score = output.score;
      if (output.metrics && typeof output.metrics === "object") metrics = output.metrics;
    } catch {
      score = Object.values(data.metrics).reduce<number>(
        (s, v) => (typeof v === "number" ? s + v : s),
        0,
      );
    }

    // Bump all live periods for this (entity, category)
    for (const period of ["all", "monthly", "weekly", "daily"] as const) {
      const { data: existing } = await supabaseAdmin
        .from("hof_scores")
        .select("score")
        .eq("entity_type", data.entity_type)
        .eq("entity_id", data.entity_id)
        .eq("period", period)
        .eq("category", data.category)
        .maybeSingle();
      const nextScore = (existing?.score ?? 0) + score;
      await supabaseAdmin
        .from("hof_scores")
        .upsert(
          {
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            period,
            category: data.category,
            score: nextScore,
            metrics: metrics as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,entity_id,period,category" },
        );
    }

    return { data: { score, period: "all" }, error: null };
  });

// ---------- nominateToHOF ----------
const NominateSchema = z.object({
  entity_type: EntityEnum,
  entity_id: z.string().uuid(),
  category: z.string().min(1),
});

export const nominateToHOF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NominateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as { userId: string; supabase: any };
    const valid = HOF_CATEGORIES.find((c) => c.key === data.category);
    if (!valid) return { ok: false as const, error: "unknown_category" };

    const { error } = await ctx.supabase.from("hof_nominations").upsert(
      {
        user_id: ctx.userId,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        category: data.category,
      },
      { onConflict: "user_id,entity_type,entity_id,category" },
    );
    if (error) return { ok: false as const, error: error.message };

    // Nominations contribute a small score bump (1 pt) to the (entity, category)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const period of ["all", "monthly", "weekly", "daily"] as const) {
        const { data: existing } = await supabaseAdmin
          .from("hof_scores")
          .select("score")
          .eq("entity_type", data.entity_type)
          .eq("entity_id", data.entity_id)
          .eq("period", period)
          .eq("category", data.category)
          .maybeSingle();
        await supabaseAdmin.from("hof_scores").upsert(
          {
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            period,
            category: data.category,
            score: (existing?.score ?? 0) + 1,
            metrics: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,entity_id,period,category" },
        );
      }
    } catch {
      // ignore — nomination row already saved
    }
    return { ok: true as const, line: "The Bench has noted your nomination." };
  });

// ---------- listLeaderboard ----------
const LeaderboardSchema = z.object({
  entity_type: EntityEnum,
  category: z.string().min(1),
  period: z.enum(HOF_PERIODS),
  limit: z.number().int().min(1).max(50).default(20),
});

export type LeaderboardEntry = {
  rank: number;
  entity_type: HofEntityType;
  entity_id: string;
  score: number;
  title: string | null;
  alias_emoji: string | null;
  alias_label: string | null;
};

export const listLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LeaderboardSchema.parse(input))
  .handler(async ({ data }): Promise<{ entries: LeaderboardEntry[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("hof_scores")
      .select("entity_type, entity_id, score, metrics")
      .eq("entity_type", data.entity_type)
      .eq("category", data.category)
      .eq("period", data.period)
      .order("score", { ascending: false })
      .limit(data.limit);

    const entries: LeaderboardEntry[] = [];
    let rank = 1;
    for (const r of (rows ?? []) as any[]) {
      let title: string | null = (r.metrics?.title as string) ?? null;
      let alias_emoji: string | null = null;
      let alias_label: string | null = null;
      try {
        if (r.entity_type === "story") {
          const { data: post } = await supabaseAdmin
            .from("posts").select("case_title, title").eq("id", r.entity_id).maybeSingle();
          title = (post as any)?.case_title ?? (post as any)?.title ?? title;
        } else if (r.entity_type === "case") {
          const { data: c } = await supabaseAdmin
            .from("court_cases").select("post_id").eq("id", r.entity_id).maybeSingle();
          if ((c as any)?.post_id) {
            const { data: post } = await supabaseAdmin
              .from("posts").select("case_title, title").eq("id", (c as any).post_id).maybeSingle();
            title = (post as any)?.case_title ?? (post as any)?.title ?? title;
          }
        } else if (r.entity_type === "user") {
          const { data: prof } = await supabaseAdmin
            .from("profiles").select("nickname, handle").eq("id", r.entity_id).maybeSingle();
          alias_label = (prof as any)?.nickname ?? (prof as any)?.handle ?? null;
          alias_emoji = "👤";
        }
      } catch { /* fallback */ }
      entries.push({
        rank: rank++,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        score: Number(r.score ?? 0),
        title,
        alias_emoji,
        alias_label,
      });
    }
    return { entries };
  });

// ---------- listEntityBadges ----------
const BadgesSchema = z.object({
  entity_type: EntityEnum,
  entity_id: z.string().uuid(),
});
export type EntityBadge = {
  id: string;
  category: string;
  category_label: string;
  emoji: string;
  period: HofPeriod;
  period_label: string;
  rank: number;
  awarded_at: string;
};

export const listEntityBadges = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BadgesSchema.parse(input))
  .handler(async ({ data }): Promise<{ badges: EntityBadge[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("hof_badges")
      .select("*")
      .eq("entity_type", data.entity_type)
      .eq("entity_id", data.entity_id)
      .order("awarded_at", { ascending: false })
      .limit(60);
    const out: EntityBadge[] = (rows ?? []).map((r: any) => {
      const cat = HOF_CATEGORIES.find((c) => c.key === r.category);
      return {
        id: r.id,
        category: r.category,
        category_label: cat?.label ?? r.category,
        emoji: r.emoji ?? cat?.emoji ?? "🏛️",
        period: r.period,
        period_label: r.period === "daily" ? "Daily" : r.period === "weekly" ? "Weekly" : r.period === "monthly" ? "Monthly" : "All Time",
        rank: r.rank,
        awarded_at: r.awarded_at,
      };
    });
    return { badges: out };
  });

// ---------- runSnapshot (cron-callable) ----------
// Captures top-3 per (entity_type x category) for `period`, awards badges,
// then resets the period's accumulated score so a new cycle can begin.
export async function runSnapshot(period: HofPeriod, now = new Date()) {
  if (period === "all") return { snapshots: 0, badges: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pkey = periodKeyFor(period, now);

  const start = new Date(now);
  if (period === "daily") start.setUTCDate(now.getUTCDate() - 1);
  else if (period === "weekly") start.setUTCDate(now.getUTCDate() - 7);
  else start.setUTCMonth(now.getUTCMonth() - 1);

  let snapshots = 0;
  let badges = 0;
  const entityTypes: HofEntityType[] = ["story", "case", "user"];

  for (const cat of HOF_CATEGORIES) {
    for (const et of entityTypes) {
      if (!cat.appliesTo.includes(et)) continue;
      const { data: top } = await supabaseAdmin
        .from("hof_scores")
        .select("entity_type, entity_id, score, metrics")
        .eq("entity_type", et)
        .eq("category", cat.key)
        .eq("period", period)
        .order("score", { ascending: false })
        .limit(10);
      let rank = 1;
      for (const row of (top ?? []) as any[]) {
        if (rank > 10) break;
        const { data: snap } = await supabaseAdmin
          .from("hof_snapshots")
          .insert({
            period: `${period}:${pkey}:${cat.key}:${et}:${rank}`,
            period_start: start.toISOString(),
            period_end: now.toISOString(),
            category: cat.key,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            rank,
            score: row.score,
            payload: { metrics: row.metrics ?? {}, period, period_key: pkey },
          })
          .select("id")
          .maybeSingle();
        snapshots++;
        if (rank <= 3) {
          await supabaseAdmin.from("hof_badges").upsert(
            {
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              category: cat.key,
              period,
              period_key: pkey,
              rank,
              emoji: cat.emoji,
              snapshot_id: (snap as any)?.id ?? null,
            },
            { onConflict: "entity_type,entity_id,category,period,period_key" },
          );
          badges++;
        }
        rank++;
      }
    }
  }

  // Reset bucket for the next cycle (keep "all" and "monthly" running long-term)
  if (period === "daily" || period === "weekly") {
    await supabaseAdmin.from("hof_scores").delete().eq("period", period);
  }

  return { snapshots, badges, period_key: pkey };
}

// Server fn wrapper for manual triggers (admin only by convention; cron uses HTTP route).
export const triggerSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ period: z.enum(HOF_PERIODS) }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string };
    const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    return runSnapshot(data.period as HofPeriod);
  });

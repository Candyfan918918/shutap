// GEO layer data functions — feeds /data pages and /llms-full.txt.
// All admin-elevated, public reads only — no PII, no draft content.
import { createServerFn } from "@tanstack/react-start";

export type CategorySlug =
  | "romance"
  | "family"
  | "work"
  | "friendship"
  | "service"
  | "stranger"
  | "digital";

const CATEGORY_MATCHERS: Record<CategorySlug, string[]> = {
  romance: ["Relationship", "Indie Romcom™", "Sweet™", "Prestige Drama™"],
  family: ["Family"],
  work: ["Work"],
  friendship: ["Friendship"],
  service: ["Service"],
  stranger: ["Stranger"],
  digital: ["Digital"],
};

export function categoryMatchers(slug: CategorySlug): string[] {
  return CATEGORY_MATCHERS[slug] ?? [];
}

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  romance: "Romance",
  family: "Family",
  work: "Work",
  friendship: "Friendship",
  service: "Service",
  stranger: "Stranger",
  digital: "Digital",
};

export type DataIndex = {
  totalCases: number;
  totalVerdicts: number;
  totalOutcomes: number;
  outcomeConfirmedPct: number; // % of resolved cases whose outcome matched the dominant verdict direction
  generatedAt: string;
  categories: Array<{ slug: CategorySlug; label: string; cases: number }>;
};

export const getDataIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<DataIndex> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [casesRes, verdictsRes, outcomesRes] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null),
      supabaseAdmin
        .from("post_verdict_votes")
        .select("id", { count: "exact", head: true })
        .eq("quarantined", false),
      supabaseAdmin
        .from("story_outcomes")
        .select("id", { count: "exact", head: true }),
    ]);

    // Confirmation pct: outcomes whose type is "vindicating" (reconciled / apology / no_contact / they_admitted_fault)
    const { data: outcomeRows } = await supabaseAdmin
      .from("story_outcomes")
      .select("outcome_type");
    const total = outcomeRows?.length ?? 0;
    const confirmed = (outcomeRows ?? []).filter((r) => {
      const t = (r as { outcome_type?: string }).outcome_type ?? "";
      return ["reconciled", "apology", "no_contact", "they_admitted_fault", "vindicated"].includes(t);
    }).length;
    const outcomeConfirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    // Per-category case counts
    const categories: DataIndex["categories"] = [];
    for (const slug of Object.keys(CATEGORY_LABELS) as CategorySlug[]) {
      const matchers = categoryMatchers(slug);
      if (matchers.length === 0) {
        categories.push({ slug, label: CATEGORY_LABELS[slug], cases: 0 });
        continue;
      }
      const { count } = await supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .in("score_category", matchers);
      categories.push({ slug, label: CATEGORY_LABELS[slug], cases: count ?? 0 });
    }

    return {
      totalCases: casesRes.count ?? 0,
      totalVerdicts: verdictsRes.count ?? 0,
      totalOutcomes: outcomesRes.count ?? 0,
      outcomeConfirmedPct,
      generatedAt: new Date().toISOString(),
      categories,
    };
  },
);

export type CategoryStats = {
  slug: CategorySlug;
  label: string;
  totalCases: number;
  totalVerdicts: number;
  guiltyPct: number;
  notGuiltyPct: number;
  topVerdicts: Array<{ kind: string; count: number; pct: number }>;
  outcomeDistribution: Array<{ outcomeType: string; count: number; pct: number }>;
  medianDaysToOutcome: number | null;
  generatedAt: string;
};

const GUILTY_KINDS = ["red_flag", "run", "lawyer_up"];
const NOT_GUILTY_KINDS = ["green_flag", "talk_it_out", "therapy_might_help"];

export const getCategoryStats = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: CategorySlug }) => d)
  .handler(async ({ data }): Promise<CategoryStats | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const matchers = categoryMatchers(data.slug);
    if (matchers.length === 0) return null;

    const { data: postRows, count: totalCases } = await supabaseAdmin
      .from("posts")
      .select("id", { count: "exact" })
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .in("score_category", matchers);

    const postIds = (postRows ?? []).map((p) => (p as { id: string }).id);

    if (postIds.length === 0) {
      return {
        slug: data.slug,
        label: CATEGORY_LABELS[data.slug],
        totalCases: 0,
        totalVerdicts: 0,
        guiltyPct: 0,
        notGuiltyPct: 0,
        topVerdicts: [],
        outcomeDistribution: [],
        medianDaysToOutcome: null,
        generatedAt: new Date().toISOString(),
      };
    }

    const { data: verdicts } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("kind")
      .eq("quarantined", false)
      .in("post_id", postIds);

    const verdictCounts = new Map<string, number>();
    for (const v of verdicts ?? []) {
      const k = (v as { kind: string }).kind;
      verdictCounts.set(k, (verdictCounts.get(k) ?? 0) + 1);
    }
    const totalVerdicts = verdicts?.length ?? 0;
    const topVerdicts = Array.from(verdictCounts.entries())
      .map(([kind, count]) => ({
        kind,
        count,
        pct: totalVerdicts > 0 ? Math.round((count / totalVerdicts) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const guilty = GUILTY_KINDS.reduce((s, k) => s + (verdictCounts.get(k) ?? 0), 0);
    const notGuilty = NOT_GUILTY_KINDS.reduce((s, k) => s + (verdictCounts.get(k) ?? 0), 0);
    const guiltyDenom = guilty + notGuilty;

    const { data: outcomes } = await supabaseAdmin
      .from("story_outcomes")
      .select("outcome_type, days_elapsed")
      .in("post_id", postIds);

    const outcomeCounts = new Map<string, number>();
    for (const o of outcomes ?? []) {
      const t = (o as { outcome_type: string }).outcome_type;
      outcomeCounts.set(t, (outcomeCounts.get(t) ?? 0) + 1);
    }
    const totalOutcomes = outcomes?.length ?? 0;
    const outcomeDistribution = Array.from(outcomeCounts.entries())
      .map(([outcomeType, count]) => ({
        outcomeType,
        count,
        pct: totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const days = (outcomes ?? [])
      .map((o) => (o as { days_elapsed: number | null }).days_elapsed)
      .filter((d): d is number => typeof d === "number")
      .sort((a, b) => a - b);
    const medianDaysToOutcome =
      days.length > 0 ? days[Math.floor(days.length / 2)] : null;

    return {
      slug: data.slug,
      label: CATEGORY_LABELS[data.slug],
      totalCases: totalCases ?? 0,
      totalVerdicts,
      guiltyPct: guiltyDenom > 0 ? Math.round((guilty / guiltyDenom) * 100) : 0,
      notGuiltyPct: guiltyDenom > 0 ? Math.round((notGuilty / guiltyDenom) * 100) : 0,
      topVerdicts,
      outcomeDistribution,
      medianDaysToOutcome,
      generatedAt: new Date().toISOString(),
    };
  });

export type LlmsFullCase = {
  id: string;
  title: string;
  question: string;
  dominantVerdict: string | null;
  dominantPct: number;
  totalVotes: number;
  outcomeType: string | null;
  outcomeDays: number | null;
};

export const getLlmsFullCases = createServerFn({ method: "GET" }).handler(
  async (): Promise<LlmsFullCase[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Top 100 resolved cases by engagement, with outcome present preferred.
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, title, story_question, like_count, comment_count, view_count")
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("view_count", { ascending: false })
      .limit(200);

    const result: LlmsFullCase[] = [];
    for (const p of posts ?? []) {
      const post = p as {
        id: string;
        title: string | null;
        story_question: string | null;
      };
      const { data: votes } = await supabaseAdmin
        .from("post_verdict_votes")
        .select("kind")
        .eq("post_id", post.id)
        .eq("quarantined", false);

      const totalVotes = votes?.length ?? 0;
      if (totalVotes === 0) continue;

      const counts = new Map<string, number>();
      for (const v of votes ?? []) {
        const k = (v as { kind: string }).kind;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const [top] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const dominantVerdict = top?.[0] ?? null;
      const dominantPct = top ? Math.round((top[1] / totalVotes) * 100) : 0;

      const { data: outcome } = await supabaseAdmin
        .from("story_outcomes")
        .select("outcome_type, days_elapsed")
        .eq("post_id", post.id)
        .maybeSingle();

      result.push({
        id: post.id,
        title: post.title ?? "Untitled case",
        question: post.story_question ?? "",
        dominantVerdict,
        dominantPct,
        totalVotes,
        outcomeType: (outcome as { outcome_type?: string } | null)?.outcome_type ?? null,
        outcomeDays: (outcome as { days_elapsed?: number } | null)?.days_elapsed ?? null,
      });

      if (result.length >= 100) break;
    }
    return result;
  },
);

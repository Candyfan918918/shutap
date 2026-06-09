// 👑 Relationship Court™ — global, regional, event-based community system.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  VERDICT_KINDS,
  type VerdictKind,
  type VerdictCounts,
} from "@/lib/posts/community.functions";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type CourtScope = "city" | "country" | "world";
export type CourtStatus =
  | "nominated"
  | "in_court"
  | "judgment_pending"
  | "decided"
  | "legendary";

export interface CourtCase {
  id: string;
  postId: string;
  scope: CourtScope;
  regionCode: string;
  regionLabel: string;
  status: CourtStatus;
  nominatedAt: string;
  opensAt: string | null;
  closesAt: string | null;
  decidedAt: string | null;
  finalVerdict: string | null;
  aiSummary: string | null;
  engagementScore: number;
  post: {
    id: string;
    title: string;
    storyText: string;
    mediaUrl: string | null;
    scoreCategory: string | null;
    score: number | null;
    badges: string[];
    commentCount: number;
    likeCount: number;
    shareCount: number;
    saveCount: number;
    authorId: string;
  } | null;
  verdict: { counts: VerdictCounts; total: number };
}

export interface ViewerRegion {
  country: string | null;
  countryLabel: string;
  city: string | null;
}

export interface HonorBadge {
  id: string;
  postId: string;
  caseId: string | null;
  badgeKind: string;
  regionLabel: string;
  pinned: boolean;
  earnedAt: string;
  post?: { id: string; title: string; mediaUrl: string | null } | null;
}

const emptyCounts = (): VerdictCounts =>
  VERDICT_KINDS.reduce((a, k) => ({ ...a, [k]: 0 }), {} as VerdictCounts);

// ──────────────────────────────────────────────────────────────
// Backwards-compat: keep existing Daily Court types/exports
// ──────────────────────────────────────────────────────────────

export interface DailyCase {
  caseDate: string;
  postId: string;
  headline: string;
  subheadline: string;
  aiSummary: string | null;
  post: CourtCase["post"];
  verdict: { counts: VerdictCounts; total: number };
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  badge: { label: string; emoji: string } | null;
}

function streakBadge(current: number): StreakInfo["badge"] {
  if (current >= 30) return { label: "Relationship judge", emoji: "⚖️" };
  if (current >= 7) return { label: "Chaos scholar", emoji: "🎓" };
  if (current >= 3) return { label: "Tea streak", emoji: "☕" };
  if (current >= 1) return { label: "Day one juror", emoji: "🧑‍⚖️" };
  return null;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getMyStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StreakInfo> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("user_streaks")
      .select("current_streak, longest_streak, last_active_date")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (row?.current_streak as number | undefined) ?? 0;
    const longest = (row?.longest_streak as number | undefined) ?? 0;
    return {
      current,
      longest,
      lastActiveDate: (row?.last_active_date as string | null) ?? null,
      badge: streakBadge(current),
    };
  });

export const recordParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StreakInfo> => {
    const { userId } = context;
    const today = todayUTC();
    const { data, error } = await supabaseAdmin.rpc("bump_streak", {
      _user_id: userId,
      _today: today,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { current_streak: number; longest_streak: number; last_active_date: string | null }
      | null;
    const current = row?.current_streak ?? 1;
    return {
      current,
      longest: row?.longest_streak ?? current,
      lastActiveDate: row?.last_active_date ?? today,
      badge: streakBadge(current),
    };
  });

// Kept for backwards compat with any pre-existing callers.
export const getTodaysCase = createServerFn({ method: "GET" })
  .handler(async (): Promise<DailyCase | null> => {
    // Pick the highest engagement case currently in court (world scope).
    const { data: cc } = await supabaseAdmin
      .from("court_cases")
      .select("id, post_id, status, ai_summary")
      .in("status", ["in_court", "legendary", "decided"])
      .order("engagement_score", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cc) return null;
    const full = await loadCase(cc.id as string);
    if (!full) return null;
    return {
      caseDate: todayUTC(),
      postId: full.postId,
      headline: "👑 Relationship Court™",
      subheadline: "Where the internet decides.",
      aiSummary: full.aiSummary,
      post: full.post,
      verdict: full.verdict,
    };
  });

// ──────────────────────────────────────────────────────────────
// Region detection
// ──────────────────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  US: "🇺🇸 US",
  GB: "🇬🇧 UK",
  CA: "🇨🇦 Canada",
  AU: "🇦🇺 Australia",
  FR: "🇫🇷 France",
  DE: "🇩🇪 Germany",
  ES: "🇪🇸 Spain",
  IT: "🇮🇹 Italy",
  JP: "🇯🇵 Japan",
  KR: "🇰🇷 Korea",
  CN: "🇨🇳 China",
  IN: "🇮🇳 India",
  BR: "🇧🇷 Brazil",
  MX: "🇲🇽 Mexico",
  NL: "🇳🇱 Netherlands",
  SE: "🇸🇪 Sweden",
  ID: "🇮🇩 Indonesia",
  PH: "🇵🇭 Philippines",
  TR: "🇹🇷 Türkiye",
  AE: "🇦🇪 UAE",
  SG: "🇸🇬 Singapore",
};

export const getViewerRegion = createServerFn({ method: "GET" }).handler(
  async (): Promise<ViewerRegion> => {
    const cc =
      getRequestHeader("cf-ipcountry") ||
      getRequestHeader("x-vercel-ip-country") ||
      getRequestHeader("x-country") ||
      null;
    const country = cc ? cc.toUpperCase() : null;
    return {
      country,
      countryLabel: country ? COUNTRY_LABELS[country] ?? `🌐 ${country}` : "🌎 World",
      city: null,
    };
  }
);

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function attachPostsAndVerdicts(
  cases: Array<{
    id: string;
    post_id: string;
    scope: CourtScope;
    region_code: string;
    region_label: string;
    status: CourtStatus;
    nominated_at: string;
    opens_at: string | null;
    closes_at: string | null;
    decided_at: string | null;
    final_verdict: string | null;
    ai_summary: string | null;
    engagement_score: number;
  }>
): Promise<CourtCase[]> {
  if (cases.length === 0) return [];
  const postIds = Array.from(new Set(cases.map((c) => c.post_id)));

  const [{ data: posts }, { data: votes }] = await Promise.all([
    supabaseAdmin
      .from("posts")
      .select(
        "id, title, story_text, media_url, score_category, score, badges, comment_count, like_count, share_count, save_count, author_id, status, visibility, deleted_at"
      )
      .in("id", postIds),
    supabaseAdmin
      .from("post_verdict_votes")
      .select("post_id, kind")
      .in("post_id", postIds),
  ]);

  const postMap = new Map<string, NonNullable<CourtCase["post"]>>();
  for (const p of (posts ?? []) as Array<Record<string, unknown>>) {
    if (
      p.status !== "published" ||
      p.visibility !== "public" ||
      p.deleted_at != null
    )
      continue;
    postMap.set(p.id as string, {
      id: p.id as string,
      title: (p.title as string) ?? "",
      storyText: (p.story_text as string) ?? "",
      mediaUrl: (p.media_url as string | null) ?? null,
      scoreCategory: (p.score_category as string | null) ?? null,
      score: (p.score as number | null) ?? null,
      badges: ((p.badges as string[] | null) ?? []) as string[],
      commentCount: (p.comment_count as number) ?? 0,
      likeCount: (p.like_count as number) ?? 0,
      shareCount: (p.share_count as number) ?? 0,
      saveCount: (p.save_count as number) ?? 0,
      authorId: p.author_id as string,
    });
  }

  const tally = new Map<string, VerdictCounts>();
  const totals = new Map<string, number>();
  for (const v of (votes ?? []) as Array<{ post_id: string; kind: VerdictKind }>) {
    if (!tally.has(v.post_id)) tally.set(v.post_id, emptyCounts());
    const t = tally.get(v.post_id)!;
    if (VERDICT_KINDS.includes(v.kind)) {
      t[v.kind] = (t[v.kind] ?? 0) + 1;
      totals.set(v.post_id, (totals.get(v.post_id) ?? 0) + 1);
    }
  }

  return cases.map((c) => ({
    id: c.id,
    postId: c.post_id,
    scope: c.scope,
    regionCode: c.region_code,
    regionLabel: c.region_label,
    status: c.status,
    nominatedAt: c.nominated_at,
    opensAt: c.opens_at,
    closesAt: c.closes_at,
    decidedAt: c.decided_at,
    finalVerdict: c.final_verdict,
    aiSummary: c.ai_summary,
    engagementScore: c.engagement_score,
    post: postMap.get(c.post_id) ?? null,
    verdict: {
      counts: tally.get(c.post_id) ?? emptyCounts(),
      total: totals.get(c.post_id) ?? 0,
    },
  }));
}

async function loadCase(caseId: string): Promise<CourtCase | null> {
  const { data: row } = await supabaseAdmin
    .from("court_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (!row) return null;
  const enriched = await attachPostsAndVerdicts([row as never]);
  return enriched[0] ?? null;
}

// ──────────────────────────────────────────────────────────────
// listCourtCases
// ──────────────────────────────────────────────────────────────

export const listCourtCases = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      scope: z.enum(["city", "country", "world"]).default("world"),
      regionCode: z.string().min(1).max(16).default("WORLD"),
      status: z
        .array(z.enum(["nominated", "in_court", "judgment_pending", "decided", "legendary"]))
        .optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }).parse
  )
  .handler(async ({ data }): Promise<CourtCase[]> => {
    let q = supabaseAdmin
      .from("court_cases")
      .select("*")
      .eq("scope", data.scope)
      .eq("region_code", data.regionCode)
      .order("status", { ascending: true })
      .order("engagement_score", { ascending: false })
      .limit(data.limit);
    if (data.status && data.status.length > 0) {
      q = q.in("status", data.status);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return attachPostsAndVerdicts((rows ?? []) as never);
  });

// ──────────────────────────────────────────────────────────────
// getCourtCase
// ──────────────────────────────────────────────────────────────

export const getCourtCase = createServerFn({ method: "GET" })
  .inputValidator(z.object({ caseId: z.string().uuid() }).parse)
  .handler(async ({ data }): Promise<CourtCase | null> => {
    return loadCase(data.caseId);
  });

// ──────────────────────────────────────────────────────────────
// getActiveCourtCaseForPost — used by FeedCard ribbon
// ──────────────────────────────────────────────────────────────

export const getActiveCourtCasesByPostIds = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ postIds: z.array(z.string().uuid()).min(0).max(60) }).parse
  )
  .handler(
    async ({
      data,
    }): Promise<
      Record<string, { caseId: string; closesAt: string | null; regionLabel: string; status: CourtStatus } | undefined>
    > => {
      if (data.postIds.length === 0) return {};
      const { data: rows } = await supabaseAdmin
        .from("court_cases")
        .select("id, post_id, closes_at, region_label, status, engagement_score")
        .in("post_id", data.postIds)
        .in("status", ["in_court", "legendary"])
        .order("engagement_score", { ascending: false });
      const out: Record<
        string,
        { caseId: string; closesAt: string | null; regionLabel: string; status: CourtStatus }
      > = {};
      for (const r of (rows ?? []) as Array<{
        id: string;
        post_id: string;
        closes_at: string | null;
        region_label: string;
        status: CourtStatus;
      }>) {
        if (!out[r.post_id]) {
          out[r.post_id] = {
            caseId: r.id,
            closesAt: r.closes_at,
            regionLabel: r.region_label,
            status: r.status,
          };
        }
      }
      return out;
    }
  );

// ──────────────────────────────────────────────────────────────
// Honor board
// ──────────────────────────────────────────────────────────────

export const getHonorBoard = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid() }).parse)
  .handler(async ({ data }): Promise<HonorBadge[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("court_case_badges")
      .select("id, post_id, case_id, badge_kind, region_label, pinned, earned_at")
      .eq("author_id", data.userId)
      .order("pinned", { ascending: false })
      .order("earned_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string;
      post_id: string;
      case_id: string | null;
      badge_kind: string;
      region_label: string;
      pinned: boolean;
      earned_at: string;
    }>;
    const postIds = Array.from(new Set(list.map((r) => r.post_id)));
    let postMap = new Map<string, { id: string; title: string; mediaUrl: string | null }>();
    if (postIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from("posts")
        .select("id, title, media_url")
        .in("id", postIds);
      for (const p of (posts ?? []) as Array<{ id: string; title: string; media_url: string | null }>) {
        postMap.set(p.id, { id: p.id, title: p.title, mediaUrl: p.media_url });
      }
    }
    return list.map((r) => ({
      id: r.id,
      postId: r.post_id,
      caseId: r.case_id,
      badgeKind: r.badge_kind,
      regionLabel: r.region_label,
      pinned: r.pinned,
      earnedAt: r.earned_at,
      post: postMap.get(r.post_id) ?? null,
    }));
  });

export const togglePinHonorBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ badgeId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<{ pinned: boolean }> => {
    const { supabase, userId } = context;
    const { data: row, error: e1 } = await supabase
      .from("court_case_badges")
      .select("id, pinned, author_id")
      .eq("id", data.badgeId)
      .maybeSingle();
    if (e1 || !row) throw new Error("Not found");
    if ((row as { author_id: string }).author_id !== userId) throw new Error("Forbidden");
    const next = !(row as { pinned: boolean }).pinned;
    const { error: e2 } = await supabase
      .from("court_case_badges")
      .update({ pinned: next })
      .eq("id", data.badgeId);
    if (e2) throw new Error(e2.message);
    return { pinned: next };
  });

// ──────────────────────────────────────────────────────────────
// Anonymous landing page server fns
// ──────────────────────────────────────────────────────────────

const STATUS_RANK: Record<CourtStatus, number> = {
  in_court: 0,
  judgment_pending: 1,
  legendary: 2,
  decided: 3,
  nominated: 4,
};

export interface FeaturedCase {
  case: CourtCase;
  author: { handle: string; nickname: string; avatarUrl: string | null } | null;
  totalRelates: number;
}

export const getFeaturedCourtCase = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedCase | null> => {
    const { data: rows } = await supabaseAdmin
      .from("court_cases")
      .select("*")
      .order("engagement_score", { ascending: false })
      .limit(30);
    if (!rows || rows.length === 0) return null;
    const enriched = await attachPostsAndVerdicts(rows as never);
    const valid = enriched.filter((c) => c.post !== null);
    if (valid.length === 0) return null;
    valid.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.engagementScore - a.engagementScore,
    );
    const featured = valid[0];
    const authorId = featured.post!.authorId;
    const [{ data: p }, { count: rel }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("handle, nickname, avatar_url")
        .eq("id", authorId)
        .maybeSingle(),
      supabaseAdmin
        .from("post_reactions")
        .select("*", { count: "exact", head: true })
        .eq("post_id", featured.post!.id)
        .eq("kind", "been_there"),
    ]);
    return {
      case: featured,
      author: p
        ? {
            handle: (p as Record<string, unknown>).handle as string,
            nickname: (p as Record<string, unknown>).nickname as string,
            avatarUrl:
              ((p as Record<string, unknown>).avatar_url as string | null) ?? null,
          }
        : null,
      totalRelates: rel ?? 0,
    };
  },
);

export const getGlobalVerdictCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ total: number }> => {
    const { count } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("*", { count: "exact", head: true });
    return { total: count ?? 0 };
  },
);


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
  | "legendary"
  | "paused"
  | "rejected";

export type CourtTier = "city" | "regional" | "national" | "world";

export interface CourtCase {
  id: string;
  postId: string;
  scope: CourtScope;
  regionCode: string;
  regionLabel: string;
  status: CourtStatus;
  currentTier: CourtTier;
  nominatedAt: string;
  opensAt: string | null;
  closesAt: string | null;
  decidedAt: string | null;
  verdictLockAt: string | null;
  finalVerdict: string | null;
  aiSummary: string | null;
  benchVerdictLine: string | null;
  finalJudgment: string | null;
  engagementScore: number;
  isFlipRound: boolean;
  flipWindowClosesAt: string | null;
  preFlipVerdict: string | null;
  flipRoundCount: number;
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
    bothSidesHeard: boolean;
    perspectiveCount: number;
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
  cases: Array<Record<string, any>>,
): Promise<CourtCase[]> {
  if (cases.length === 0) return [];
  const postIds = Array.from(new Set(cases.map((c) => c.post_id as string)));

  const [{ data: posts }, { data: votes }] = await Promise.all([
    supabaseAdmin
      .from("posts")
      .select(
        "id, title, story_text, media_url, score_category, score, badges, comment_count, like_count, share_count, save_count, author_id, status, visibility, deleted_at, both_sides_heard, perspective_count",
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
      bothSidesHeard: !!p.both_sides_heard,
      perspectiveCount: (p.perspective_count as number) ?? 0,
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

  const ALLOWED_TIERS: ReadonlyArray<CourtTier> = ["city", "regional", "national", "world"];
  const resolveTier = (c: Record<string, any>): CourtTier => {
    const t = c.current_tier as string | null;
    if (t && (ALLOWED_TIERS as string[]).includes(t)) return t as CourtTier;
    return (c.scope as string) === "country" ? "national" : (c.scope as CourtTier) ?? "city";
  };

  return cases.map((c) => ({
    id: c.id as string,
    postId: c.post_id as string,
    scope: c.scope as CourtScope,
    regionCode: c.region_code as string,
    regionLabel: c.region_label as string,
    status: c.status as CourtStatus,
    currentTier: resolveTier(c),
    nominatedAt: c.nominated_at as string,
    opensAt: (c.opens_at as string | null) ?? null,
    closesAt: (c.closes_at as string | null) ?? null,
    decidedAt: (c.decided_at as string | null) ?? null,
    verdictLockAt: (c.verdict_lock_at as string | null) ?? (c.closes_at as string | null) ?? null,
    finalVerdict: (c.final_verdict as string | null) ?? null,
    aiSummary: (c.ai_summary as string | null) ?? null,
    benchVerdictLine: (c.bench_verdict_line as string | null) ?? null,
    finalJudgment: (c.final_judgment as string | null) ?? null,
    engagementScore: (c.engagement_score as number) ?? 0,
    isFlipRound: !!(c as any).is_flip_round,
    flipWindowClosesAt: ((c as any).flip_window_closes_at as string | null) ?? null,
    preFlipVerdict: ((c as any).pre_flip_verdict as string | null) ?? null,
    flipRoundCount: ((c as any).flip_round_count as number) ?? 0,
    post: postMap.get(c.post_id as string) ?? null,
    verdict: {
      counts: tally.get(c.post_id as string) ?? emptyCounts(),
      total: totals.get(c.post_id as string) ?? 0,
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
  paused: 5,
  rejected: 6,
};


export interface FeaturedCase {
  case: CourtCase;
  author: { handle: string; nickname: string; avatarUrl: string | null } | null;
  totalRelates: number;
}

export const getFeaturedCourtCase = createServerFn({ method: "GET" })
  .handler(
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

export const getGlobalVerdictTally = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ total: number }> => {
    const { count } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("*", { count: "exact", head: true });
    return { total: count ?? 0 };
  },
);

// ──────────────────────────────────────────────────────────────
// Teaser feed (anonymous landing)
// ──────────────────────────────────────────────────────────────

export interface TeaserPost {
  id: string;
  title: string;
  storyText: string;
  score: number | null;
  scoreCategory: string | null;
  badges: string[];
  mediaUrl: string | null;
  commentCount: number;
  likeCount: number;
  shareCount: number;
  author: { handle: string; nickname: string; avatarUrl: string | null } | null;
  relateCount: number;
  verdictTotal: number;
}

export const getTeaserFeed = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ excludePostId: z.string().uuid().optional() }).parse,
  )
  .handler(async ({ data }): Promise<TeaserPost[]> => {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabaseAdmin
      .from("posts")
      .select(
        "id, author_id, title, story_text, score, score_category, badges, media_url, comment_count, like_count, share_count",
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("score", { ascending: false })
      .limit(10);

    if (data.excludePostId) {
      q = q.neq("id", data.excludePostId);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const posts = (rows ?? []) as Array<{
      id: string; author_id: string; title: string; story_text: string;
      score: number | null; score_category: string | null; badges: string[];
      media_url: string | null; comment_count: number; like_count: number;
      share_count: number;
    }>;

    if (posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);
    const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));

    const [profilesRes, verdictsRes, relatesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, handle, nickname, avatar_url")
        .in("id", authorIds),
      supabaseAdmin
        .from("post_verdict_counts")
        .select("post_id, count")
        .in("post_id", postIds),
      supabaseAdmin
        .from("post_reaction_counts")
        .select("post_id, count")
        .in("post_id", postIds)
        .eq("kind", "been_there"),
    ]);

    const byAuthor = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id as string,
        {
          handle: (p as Record<string, unknown>).handle as string,
          nickname: (p as Record<string, unknown>).nickname as string,
          avatarUrl: ((p as Record<string, unknown>).avatar_url as string | null) ?? null,
        },
      ]),
    );

    const verdictTotals = new Map<string, number>();
    for (const v of (verdictsRes.data ?? []) as Array<{ post_id: string; count: number }>) {
      verdictTotals.set(v.post_id, (verdictTotals.get(v.post_id) ?? 0) + v.count);
    }

    const relateTotals = new Map<string, number>();
    for (const r of (relatesRes.data ?? []) as Array<{ post_id: string; count: number }>) {
      relateTotals.set(r.post_id, r.count);
    }

    return posts.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      storyText: p.story_text,
      score: p.score,
      scoreCategory: p.score_category,
      badges: p.badges,
      mediaUrl: p.media_url,
      commentCount: p.comment_count ?? 0,
      likeCount: p.like_count ?? 0,
      shareCount: p.share_count ?? 0,
      author: byAuthor.get(p.author_id) ?? null,
      relateCount: relateTotals.get(p.id) ?? 0,
      verdictTotal: verdictTotals.get(p.id) ?? 0,
    }));
  });

export const getOpenCaseCount = createServerFn({ method: "GET" })
  .handler(
  async (): Promise<{ count: number }> => {
    const { count } = await supabaseAdmin
      .from("court_cases")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_court");
    return { count: count ?? 0 };
  },
);

// ──────────────────────────────────────────────────────────────
// Hall of Fame (anonymous landing) — fully readable, no gates on content
// ──────────────────────────────────────────────────────────────

export interface HofPostBase {
  id: string;
  title: string;
  storyText: string;
  scoreCategory: string | null;
  score: number | null;
  mediaUrl: string | null;
  author: { handle: string; nickname: string; avatarUrl: string | null } | null;
}

export interface HofDramatic extends HofPostBase {
  verdictCounts: Record<string, number>;
  verdictTotal: number;
  benchVerdictLine: string;
}

export interface HofRelatable extends HofPostBase {
  relateCount: number;
}

export interface HofSurprising extends HofPostBase {
  dominantVerdict: string | null;
  dominantPct: number;
  outcomeType: string;
  daysToOutcome: number;
  decidedAt: string;
}

export interface HallOfFame {
  dramatic: HofDramatic | null;
  relatable: HofRelatable | null;
  surprising: HofSurprising | null;
  todayVotes: number;
}

const VERDICT_LABEL: Record<string, string> = {
  red_flag: "🚩 Red Flag",
  green_flag: "💚 Green Flag",
  run: "🏃 RUN",
  talk_it_out: "🗣 Talk It Out",
  lawyer_up: "⚖️ Lawyer Up",
  therapy_might_help: "🛋 Therapy",
  need_update: "👀 Need Update",
};

async function loadHofAuthorMap(authorIds: string[]) {
  if (authorIds.length === 0) return new Map<string, HofPostBase["author"]>();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, nickname, avatar_url")
    .in("id", authorIds);
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      {
        handle: (p as Record<string, unknown>).handle as string,
        nickname: (p as Record<string, unknown>).nickname as string,
        avatarUrl:
          ((p as Record<string, unknown>).avatar_url as string | null) ?? null,
      } as HofPostBase["author"],
    ]),
  );
}

export const getHallOfFame = createServerFn({ method: "GET" })
  .handler(
  async (): Promise<HallOfFame> => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: todayVotes } = await supabaseAdmin
      .from("post_verdict_votes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    // Segment 1 — Most Dramatic Today (fallback to 7d)
    let dramatic: HofDramatic | null = null;
    for (const since of [since24h, since7d]) {
      const { data: rows } = await supabaseAdmin
        .from("posts")
        .select(
          "id, author_id, title, story_text, score, score_category, media_url",
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .gte("published_at", since)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(1);
      const p = (rows ?? [])[0] as
        | {
            id: string; author_id: string; title: string; story_text: string;
            score: number | null; score_category: string | null; media_url: string | null;
          }
        | undefined;
      if (!p) continue;
      const [authors, votesRes] = await Promise.all([
        loadHofAuthorMap([p.author_id]),
        supabaseAdmin.from("post_verdict_votes").select("kind").eq("post_id", p.id),
      ]);
      const counts: Record<string, number> = {};
      for (const v of (votesRes.data ?? []) as Array<{ kind: string }>) {
        counts[v.kind] = (counts[v.kind] ?? 0) + 1;
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const benchLine = top
        ? `The bench: this one's a ${VERDICT_LABEL[top[0]] ?? top[0]}.`
        : "The bench: the jury's still arriving.";
      dramatic = {
        id: p.id,
        title: p.title,
        storyText: p.story_text,
        score: p.score,
        scoreCategory: p.score_category,
        mediaUrl: p.media_url,
        author: authors.get(p.author_id) ?? null,
        verdictCounts: counts,
        verdictTotal: total,
        benchVerdictLine: benchLine,
      };
      break;
    }

    // Segment 2 — Most Relatable This Week (fallback all-time)
    let relatable: HofRelatable | null = null;
    {
      const { data: rRows } = await supabaseAdmin
        .from("post_reactions")
        .select("post_id")
        .eq("kind", "been_there")
        .gte("created_at", since7d)
        .limit(5000);
      const tally = new Map<string, number>();
      for (const r of (rRows ?? []) as Array<{ post_id: string }>) {
        tally.set(r.post_id, (tally.get(r.post_id) ?? 0) + 1);
      }
      let pickId: string | null = null;
      let pickCount = 0;
      for (const [pid, c] of tally) {
        if (c > pickCount) { pickId = pid; pickCount = c; }
      }
      if (!pickId) {
        const { data: allRows } = await supabaseAdmin
          .from("post_reaction_counts")
          .select("post_id, count")
          .eq("kind", "been_there")
          .order("count", { ascending: false })
          .limit(1);
        const top = (allRows ?? [])[0] as { post_id: string; count: number } | undefined;
        if (top) { pickId = top.post_id; pickCount = top.count; }
      }
      if (pickId) {
        const { data: postRow } = await supabaseAdmin
          .from("posts")
          .select("id, author_id, title, story_text, score, score_category, media_url, status, visibility, deleted_at")
          .eq("id", pickId)
          .maybeSingle();
        const p = postRow as Record<string, unknown> | null;
        if (p && p.status === "published" && p.visibility === "public" && !p.deleted_at) {
          const authors = await loadHofAuthorMap([p.author_id as string]);
          relatable = {
            id: p.id as string,
            title: p.title as string,
            storyText: p.story_text as string,
            score: (p.score as number | null) ?? null,
            scoreCategory: (p.score_category as string | null) ?? null,
            mediaUrl: (p.media_url as string | null) ?? null,
            author: authors.get(p.author_id as string) ?? null,
            relateCount: pickCount,
          };
        }
      }
    }

    // Segment 3 — Most Surprising Outcome (all time)
    let surprising: HofSurprising | null = null;
    {
      const { data: decided } = await supabaseAdmin
        .from("court_cases")
        .select("id, post_id, decided_at, final_verdict, engagement_score")
        .in("status", ["decided", "legendary"])
        .not("decided_at", "is", null)
        .order("engagement_score", { ascending: false })
        .limit(20);
      const cases = (decided ?? []) as Array<{
        id: string; post_id: string; decided_at: string;
        final_verdict: string | null; engagement_score: number;
      }>;
      if (cases.length > 0) {
        const postIds = cases.map((c) => c.post_id);
        const { data: updates } = await supabaseAdmin
          .from("post_updates")
          .select("post_id, kind, created_at")
          .in("post_id", postIds)
          .eq("status", "published")
          .is("deleted_at", null)
          .order("created_at", { ascending: true });
        const firstUpdate = new Map<string, { kind: string; created_at: string }>();
        for (const u of (updates ?? []) as Array<{ post_id: string; kind: string; created_at: string }>) {
          if (!firstUpdate.has(u.post_id)) firstUpdate.set(u.post_id, { kind: u.kind, created_at: u.created_at });
        }
        const pick = cases.find((c) => firstUpdate.has(c.post_id))
          ?? cases.find((c) => c.final_verdict && c.final_verdict !== "no_verdict")
          ?? cases[0];
        const upd = firstUpdate.get(pick.post_id);
        const { data: postRow } = await supabaseAdmin
          .from("posts")
          .select("id, author_id, title, story_text, score, score_category, media_url, status, visibility, deleted_at")
          .eq("id", pick.post_id)
          .maybeSingle();
        const p = postRow as Record<string, unknown> | null;
        if (p && p.status === "published" && p.visibility === "public" && !p.deleted_at) {
          const authors = await loadHofAuthorMap([p.author_id as string]);
          const { data: votes } = await supabaseAdmin
            .from("post_verdict_votes")
            .select("kind")
            .eq("post_id", pick.post_id);
          const counts: Record<string, number> = {};
          for (const v of (votes ?? []) as Array<{ kind: string }>) {
            counts[v.kind] = (counts[v.kind] ?? 0) + 1;
          }
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          const dominantKind = top?.[0] ?? pick.final_verdict ?? null;
          const dominantPct = top && total > 0 ? Math.round((top[1] / total) * 100) : 0;
          const endTs = upd ? new Date(upd.created_at).getTime() : Date.now();
          const days = Math.max(
            1,
            Math.round((endTs - new Date(pick.decided_at).getTime()) / (24 * 60 * 60 * 1000)),
          );
          surprising = {
            id: p.id as string,
            title: p.title as string,
            storyText: p.story_text as string,
            score: (p.score as number | null) ?? null,
            scoreCategory: (p.score_category as string | null) ?? null,
            mediaUrl: (p.media_url as string | null) ?? null,
            author: authors.get(p.author_id as string) ?? null,
            dominantVerdict: dominantKind ? (VERDICT_LABEL[dominantKind] ?? dominantKind) : null,
            dominantPct,
            outcomeType: upd
              ? upd.kind === "outcome"
                ? "the truth came out"
                : upd.kind === "resolved"
                  ? "they worked it out"
                  : upd.kind === "plot_twist"
                    ? "a plot twist landed"
                    : "they posted an update"
              : "the story is still unfolding",
            daysToOutcome: days,
            decidedAt: pick.decided_at,
          };
        }
      }
    }

    return {
      dramatic,
      relatable,
      surprising,
      todayVotes: todayVotes ?? 0,
    };
  },
);





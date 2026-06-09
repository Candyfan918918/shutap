// First-session stream — curated 5-card sequence shown right after a user
// claims their alias for the first time. The 5 cards are:
//   1. The post they just acted on (passed by client as entryPostId)
//   2. HOF Most Dramatic today
//   3. HOF Most Relatable this week
//   4. SpillCTACard (no DB; client renders inline)
//   5. A live Court case in its final hour
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface FirstSessionPost {
  id: string;
  title: string;
  storyText: string;
  scoreCategory: string | null;
  mediaUrl: string | null;
  author: { handle: string; nickname: string; avatarUrl: string | null } | null;
  verdictTotal: number;
  relateCount: number;
}

export interface FirstSessionFinalHour {
  caseId: string;
  postId: string;
  title: string;
  storyText: string;
  scoreCategory: string | null;
  mediaUrl: string | null;
  closesAt: string;
  regionLabel: string;
  verdictTotal: number;
}

export interface FirstSessionStream {
  entry: FirstSessionPost | null;
  dramatic: FirstSessionPost | null;
  relatable: FirstSessionPost | null;
  finalHour: FirstSessionFinalHour | null;
}

async function loadPostCard(
  postId: string,
): Promise<FirstSessionPost | null> {
  const { data: postRow } = await supabaseAdmin
    .from("posts")
    .select(
      "id, author_id, title, story_text, score_category, media_url, status, visibility, deleted_at",
    )
    .eq("id", postId)
    .maybeSingle();
  const p = postRow as Record<string, unknown> | null;
  if (
    !p ||
    p.status !== "published" ||
    p.visibility !== "public" ||
    p.deleted_at
  ) {
    return null;
  }
  const authorId = p.author_id as string;
  const [authorRes, verdictsRes, relatesRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("handle, nickname, avatar_url")
      .eq("id", authorId)
      .maybeSingle(),
    supabaseAdmin
      .from("post_verdict_counts")
      .select("count")
      .eq("post_id", postId),
    supabaseAdmin
      .from("post_reaction_counts")
      .select("count")
      .eq("post_id", postId)
      .eq("kind", "been_there"),
  ]);
  const verdictTotal = ((verdictsRes.data ?? []) as Array<{ count: number }>)
    .reduce((a, r) => a + (r.count ?? 0), 0);
  const relateCount =
    ((relatesRes.data ?? []) as Array<{ count: number }>)[0]?.count ?? 0;
  const a = authorRes.data as Record<string, unknown> | null;
  return {
    id: p.id as string,
    title: p.title as string,
    storyText: p.story_text as string,
    scoreCategory: (p.score_category as string | null) ?? null,
    mediaUrl: (p.media_url as string | null) ?? null,
    author: a
      ? {
          handle: a.handle as string,
          nickname: a.nickname as string,
          avatarUrl: (a.avatar_url as string | null) ?? null,
        }
      : null,
    verdictTotal,
    relateCount,
  };
}

export const getFirstSessionStream = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        entryPostId: z.string().uuid().optional(),
      })
      .parse,
  )
  .handler(async ({ data }): Promise<FirstSessionStream> => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 1. Entry post (the one they just acted on)
    const entry = data.entryPostId
      ? await loadPostCard(data.entryPostId)
      : null;
    const excludeIds = new Set<string>();
    if (entry) excludeIds.add(entry.id);

    // 2. Dramatic: highest score in last 24h
    let dramatic: FirstSessionPost | null = null;
    for (const since of [since24h, since7d]) {
      const { data: rows } = await supabaseAdmin
        .from("posts")
        .select("id")
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .gte("published_at", since)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(5);
      const candidate = ((rows ?? []) as Array<{ id: string }>).find(
        (r) => !excludeIds.has(r.id),
      );
      if (candidate) {
        dramatic = await loadPostCard(candidate.id);
        if (dramatic) {
          excludeIds.add(dramatic.id);
          break;
        }
      }
    }

    // 3. Relatable: top been_there reactions this week
    let relatable: FirstSessionPost | null = null;
    {
      const { data: rRows } = await supabaseAdmin
        .from("post_reactions")
        .select("post_id")
        .eq("kind", "been_there")
        .gte("created_at", since7d)
        .limit(5000);
      const tally = new Map<string, number>();
      for (const r of (rRows ?? []) as Array<{ post_id: string }>) {
        if (excludeIds.has(r.post_id)) continue;
        tally.set(r.post_id, (tally.get(r.post_id) ?? 0) + 1);
      }
      const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
      for (const [pid] of sorted) {
        const card = await loadPostCard(pid);
        if (card) {
          relatable = card;
          excludeIds.add(card.id);
          break;
        }
      }
    }

    // 5. Final-hour case: in_court, closing within next 60 minutes, soonest first
    let finalHour: FirstSessionFinalHour | null = null;
    {
      const nowIso = new Date().toISOString();
      const in60min = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { data: cRows } = await supabaseAdmin
        .from("court_cases")
        .select(
          "id, post_id, closes_at, region_label, status",
        )
        .eq("status", "in_court")
        .not("closes_at", "is", null)
        .gte("closes_at", nowIso)
        .lte("closes_at", in60min)
        .order("closes_at", { ascending: true })
        .limit(5);
      // Fallback: any in_court soonest-closing
      const fallback = !cRows || cRows.length === 0;
      const candidates = fallback
        ? (
            await supabaseAdmin
              .from("court_cases")
              .select("id, post_id, closes_at, region_label, status")
              .eq("status", "in_court")
              .not("closes_at", "is", null)
              .gte("closes_at", nowIso)
              .order("closes_at", { ascending: true })
              .limit(5)
          ).data ?? []
        : cRows;
      for (const c of candidates as Array<{
        id: string;
        post_id: string;
        closes_at: string;
        region_label: string;
      }>) {
        if (excludeIds.has(c.post_id)) continue;
        const card = await loadPostCard(c.post_id);
        if (!card) continue;
        finalHour = {
          caseId: c.id,
          postId: c.post_id,
          title: card.title,
          storyText: card.storyText,
          scoreCategory: card.scoreCategory,
          mediaUrl: card.mediaUrl,
          closesAt: c.closes_at,
          regionLabel: c.region_label,
          verdictTotal: card.verdictTotal,
        };
        break;
      }
    }

    return { entry, dramatic, relatable, finalHour };
  });

// Check whether any case the user voted on has just reached a verdict.
// Used to surface the deferred notification-permission prompt.
export const getJustDecidedVotedCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ caseId: string; postId: string; title: string } | null> => {
      const { supabase, userId } = context;
      const { data: votes } = await supabase
        .from("post_verdict_votes")
        .select("post_id")
        .eq("user_id", userId)
        .limit(200);
      const postIds = Array.from(
        new Set(((votes ?? []) as Array<{ post_id: string }>).map((v) => v.post_id)),
      );
      if (postIds.length === 0) return null;
      const { data: cases } = await supabaseAdmin
        .from("court_cases")
        .select("id, post_id, decided_at, status")
        .in("post_id", postIds)
        .in("status", ["decided", "legendary"])
        .order("decided_at", { ascending: false })
        .limit(1);
      const c = ((cases ?? []) as Array<{
        id: string;
        post_id: string;
      }>)[0];
      if (!c) return null;
      const { data: postRow } = await supabaseAdmin
        .from("posts")
        .select("title")
        .eq("id", c.post_id)
        .maybeSingle();
      return {
        caseId: c.id,
        postId: c.post_id,
        title:
          (postRow as { title?: string } | null)?.title ?? "Your case",
      };
    },
  );

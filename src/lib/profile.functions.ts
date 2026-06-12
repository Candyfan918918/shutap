// Profile read/write server functions: public profile by handle, my profile,
// update display name/bio/anonymous mode, handle availability + suggestions,
// avatar upload signed-URL, AI avatar generation.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { HANDLE_RE, slugifyHandle } from "@/lib/handles";
import { deriveBadges, type BadgeStats, type Badge } from "@/lib/badges";

// Resolve caller userId from the request's Bearer token. Never trust a
// client-supplied viewer id — that lets anyone spoof friendship lookups.
async function resolveViewerId(): Promise<string | null> {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    if (!token) return null;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const tmp = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await tmp.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

export type TrustTier =
  | "Building trust"
  | "Established juror"
  | "Respected voice"
  | "Court elder"
  | "Legend";

export function trustTierFor(score: number): TrustTier {
  if (score >= 800) return "Legend";
  if (score >= 500) return "Court elder";
  if (score >= 300) return "Respected voice";
  if (score >= 100) return "Established juror";
  return "Building trust";
}

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  emoji: string | null;
  cityLabel: string | null;
  countryCode: string | null;
  vibe: string | null;
  anonymousMode: boolean;
  // counts (Shutap vocabulary)
  followerCount: number;
  followingCount: number;
  postCount: number; // cases brought
  counselCount: number; // counsel given
  courtAppearances: number; // distinct cases voted on
  outcomesTracked: number; // outcomes the user has reported
  trustScore: number;
  trustTier: TrustTier;
  avgScore: number;
  maxScore: number;
  badges: Badge[];
  // viewer-relative
  isMe: boolean;
  isFollowing: boolean;
  friendship: "none" | "pending_out" | "pending_in" | "accepted" | "declined";
}

export interface MyProfile extends PublicProfile {
  email: string | null;
  locale: string;
  notifPrefs: Record<string, boolean>;
  privacy: Record<string, boolean>;
  avatarKind: string;
}

const HandleSchema = z.string().regex(HANDLE_RE, "invalid handle").max(24);

const PROFILE_COLS =
  "id, handle, display_name, nickname, bio, avatar_url, emoji, city_label, country_code, vibe, anonymous_mode, locale, email, notif_prefs, privacy, avatar_kind";

// ---------- public profile by handle ----------
export const getProfileByHandle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ handle: HandleSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicProfile | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("handle", data.handle)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    // Derive viewer from the Bearer token — never trust client input.
    const viewerId = await resolveViewerId();
    return await hydrateProfile(row as Record<string, unknown>, viewerId);
  });

// ---------- my profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile | null> => {
    const { userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const base = await hydrateProfile(row as Record<string, unknown>, userId);
    return {
      ...base,
      email: (row as Record<string, unknown>).email as string | null,
      locale: ((row as Record<string, unknown>).locale as string) ?? "en",
      notifPrefs: (((row as Record<string, unknown>).notif_prefs as Record<string, boolean>) ?? {}),
      privacy: (((row as Record<string, unknown>).privacy as Record<string, boolean>) ?? {}),
      avatarKind: (((row as Record<string, unknown>).avatar_kind as string) ?? "default"),
    };
  });

async function hydrateProfile(
  row: Record<string, unknown>,
  viewerId: string | null,
): Promise<PublicProfile> {
  const id = row.id as string;

  // Parallel aggregates
  const [followers, following, posts, scans, friendship, counsel, votes, outcomes, repRow] = await Promise.all([
    supabaseAdmin.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", id),
    supabaseAdmin.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", id),
    supabaseAdmin
      .from("posts")
      .select("score, like_count, share_count", { count: "exact" })
      .eq("author_id", id)
      .eq("status", "published")
      .is("deleted_at", null),
    supabaseAdmin.from("scan_results").select("id", { count: "exact", head: true }).eq("user_id", id).eq("status", "completed"),
    viewerId && viewerId !== id
      ? supabaseAdmin
          .from("friendships")
          .select("requester_id, addressee_id, status")
          .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${viewerId})`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("status", "published")
      .is("deleted_at", null),
    supabaseAdmin
      .from("post_verdict_votes")
      .select("post_id")
      .eq("user_id", id),
    supabaseAdmin
      .from("story_outcomes")
      .select("post_id", { count: "exact", head: true })
      .eq("author_id", id),
    supabaseAdmin
      .from("profiles")
      .select("justice_score, wisdom_score, empathy_score, prediction_score")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const isFollowing = viewerId && viewerId !== id
    ? !!(await supabaseAdmin
        .from("follows")
        .select("follower_id", { head: true, count: "exact" })
        .eq("follower_id", viewerId)
        .eq("followee_id", id)).count
    : false;

  let friendshipState: PublicProfile["friendship"] = "none";
  const fr = (friendship.data ?? null) as null | { requester_id: string; addressee_id: string; status: string };
  if (fr) {
    if (fr.status === "accepted") friendshipState = "accepted";
    else if (fr.status === "declined") friendshipState = "declined";
    else if (fr.status === "pending") friendshipState = fr.requester_id === viewerId ? "pending_out" : "pending_in";
  }

  const postRows = (posts.data as Array<{ score: number | null; like_count: number; share_count: number }> | null) ?? [];
  const totalLikes = postRows.reduce((a, p) => a + (p.like_count ?? 0), 0);
  const totalShares = postRows.reduce((a, p) => a + (p.share_count ?? 0), 0);
  const scoresOnly = postRows.map((p) => p.score ?? 0).filter((s) => s > 0);
  const avgScore = scoresOnly.length ? Math.round(scoresOnly.reduce((a, b) => a + b, 0) / scoresOnly.length) : 0;
  const maxScore = scoresOnly.length ? Math.max(...scoresOnly) : 0;
  const postCount = posts.count ?? 0;
  const scanCount = scans.count ?? 0;

  const stats: BadgeStats = { postCount, totalLikes, totalShares, avgScore, maxScore, scanCount };
  const badges = deriveBadges(stats);

  const anonymousMode = ((row.anonymous_mode as boolean | null) ?? true);

  
  const aliasName = (row.nickname as string | null) ?? null;
  // Anonymous mode (default) → always show the assigned alias for both
  // display name and @handle. Only when the user turns anonymity off do we
  // surface their edited real display_name; the @handle stays as stored.
  const resolvedDisplayName = anonymousMode
    ? (aliasName ?? (row.display_name as string | null) ?? row.handle as string)
    : ((row.display_name as string | null) ?? aliasName ?? row.handle as string);

  return {
    id,
    handle: row.handle as string,
    displayName: resolvedDisplayName,
    bio: (row.bio as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    emoji: (row.emoji as string | null) ?? null,
    cityLabel: anonymousMode ? null : ((row.city_label as string | null) ?? null),
    countryCode: (row.country_code as string | null) ?? null,
    vibe: (row.vibe as string | null) ?? null,
    anonymousMode,
    followerCount: followers.count ?? 0,
    followingCount: following.count ?? 0,
    postCount,
    avgScore: anonymousMode && viewerId !== id ? 0 : avgScore,
    maxScore,
    badges,
    isMe: viewerId === id,
    isFollowing,
    friendship: friendshipState,
  };
}

// ---------- update profile ----------
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(200).optional(),
        anonymousMode: z.boolean().optional(),
        locale: z.string().min(2).max(8).optional(),
        notifPrefs: z.record(z.string().max(40), z.boolean()).optional(),
        privacy: z.record(z.string().max(40), z.boolean()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.displayName !== undefined) {
      // Only update display_name (real-name override shown when anonymity is
      // off). Never overwrite `nickname` — that's the immutable assigned alias.
      patch.display_name = data.displayName;
    }
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.anonymousMode !== undefined) patch.anonymous_mode = data.anonymousMode;
    if (data.locale !== undefined) patch.locale = data.locale;
    if (data.notifPrefs !== undefined) patch.notif_prefs = data.notifPrefs;
    if (data.privacy !== undefined) patch.privacy = data.privacy;
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- handle availability + change ----------
export const checkHandleAvailable = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ handle: z.string().max(40) }).parse(input))
  .handler(async ({ data }): Promise<{ available: boolean; suggestions: string[] }> => {
    const slug = slugifyHandle(data.handle);
    if (!HANDLE_RE.test(slug)) {
      const { data: sg } = await supabaseAdmin.rpc("suggest_handles", { _base: slug || "user" });
      return { available: false, suggestions: (sg as string[] | null) ?? [] };
    }
    const { data: row } = await supabaseAdmin.from("profiles").select("id").eq("handle", slug).maybeSingle();
    if (!row) return { available: true, suggestions: [] };
    const { data: sg } = await supabaseAdmin.rpc("suggest_handles", { _base: slug });
    return { available: false, suggestions: (sg as string[] | null) ?? [] };
  });

export const changeMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ handle: HandleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Atomic-ish: rely on unique index
    const { error } = await supabase.from("profiles").update({ handle: data.handle } as never).eq("id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("that handle was just taken — pick another");
      throw new Error(error.message);
    }
    return { ok: true, handle: data.handle };
  });

// ---------- avatar upload (signed URL) ----------
export const createAvatarUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ext: z.enum(["png", "jpg", "jpeg", "webp"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const path = `avatars/${userId}/${Date.now()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("story-media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("story-media").getPublicUrl(path);
    return { uploadUrl: signed.signedUrl, token: signed.token, path, publicUrl: pub.publicUrl };
  });

export const setMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        avatarUrl: z.string().url(),
        kind: z.enum(["upload", "ai", "default"]).default("upload"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.avatarUrl, avatar_kind: data.kind } as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI avatar generation (rate-limited 5/day) ----------
export const generateAiAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        style: z.enum(["cartoon", "anime", "luxury", "chaos", "mysterious", "soft"]).default("cartoon"),
        prompt: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { userId } = context;

    // Rate limit
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("post_views") // reuse for cheap aux storage? no — use a dedicated count. Simpler: count by avatar_kind history via storage list
      .select("id", { head: true, count: "exact" })
      .eq("session_hash", `ai_avatar:${userId}`)
      .gte("viewed_at", since);
    if ((count ?? 0) >= 5) throw new Error("hit your daily avatar limit (5/day). try tomorrow ✨");

    const styleHint: Record<string, string> = {
      cartoon: "cute flat cartoon avatar, vibrant pastel palette, simple geometric shapes",
      anime: "anime-style portrait, soft cel-shading, expressive eyes",
      luxury: "glossy editorial portrait, gold accents, fashion-magazine lighting",
      chaos: "maximalist surreal portrait, swirls of color, dramatic",
      mysterious: "shadowed minimalist silhouette, muted palette, mysterious vibe",
      soft: "soft aesthetic portrait, dreamy pastel gradient, gentle",
    };
    const promptText = `${styleHint[data.style]}. anonymous gender-neutral character. centered, head-and-shoulders. no text. ${data.prompt ?? ""}`.trim();

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is offline rn. try again later.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: promptText }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI is busy. try again in a sec.");
      if (res.status === 402) throw new Error("we're out of AI credits 😭");
      throw new Error("AI avatar failed");
    }
    const json = await res.json();
    const imageB64 = json.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!imageB64) throw new Error("no image returned");

    // Convert data URL → buffer
    const m = imageB64.match(/^data:(.+);base64,(.+)$/);
    if (!m) throw new Error("bad image format");
    const contentType = m[1];
    const buf = Buffer.from(m[2], "base64");
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `avatars/${userId}/ai-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("story-media").upload(path, buf, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabaseAdmin.storage.from("story-media").getPublicUrl(path);

    // Record usage via post_views audit row (cheap, no extra table)
    await supabaseAdmin.from("post_views").insert({
      post_id: userId, // sentinel
      viewer_id: userId,
      session_hash: `ai_avatar:${userId}`,
    });

    // Save on profile
    await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: pub.publicUrl, avatar_kind: "ai" } as never)
      .eq("id", userId);

    return { url: pub.publicUrl };
  });

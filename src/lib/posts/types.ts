// Shared types for the post engine. Safe to import from client and server.

export type PostTone = "funny" | "serious" | "chaotic" | "soft";
export type SharePlatform =
  | "x"
  | "tiktok"
  | "instagram"
  | "xiaohongshu"
  | "facebook"
  | "imessage"
  | "whatsapp"
  | "copy_link";
export type ReactionKind = "been_there" | "worse" | "hug" | "laugh" | "drama";

export type PlatformCaptions = Partial<Record<Exclude<SharePlatform, "copy_link">, string>>;

export type DraftPayload = {
  title: string;
  story: string;
  badges: string[];
  hashtags: string[];
  platform_captions: PlatformCaptions;
};

export type ScoreContext = {
  score: number;
  category: string;
  subscores?: Record<string, number>;
  tags?: string[];
  locale: string;
  raw_answers?: string;
};

export type PostRecord = {
  id: string;
  author_id: string;
  status: "draft" | "published" | "removed";
  title: string;
  story_text: string;
  tone: PostTone;
  badges: string[];
  hashtags: string[];
  media_url: string | null;
  share_card_square: string | null;
  share_card_vertical: string | null;
  share_card_xhs: string | null;
  platform_captions: PlatformCaptions;
  locale: string;
  score: number | null;
  score_category: string | null;
  published_at: string | null;
  created_at: string;
};

export function scoreTier(score: number): "legendary" | "high" | "mid" | "low" | "sweet" {
  if (score >= 800) return "legendary";
  if (score >= 600) return "high";
  if (score >= 350) return "mid";
  if (score >= 150) return "low";
  return "sweet";
}

export function scoreCategoryLabel(score: number): string {
  const tier = scoreTier(score);
  return tier === "legendary"
    ? "Netflix Original™"
    : tier === "high"
    ? "Prestige Drama™"
    : tier === "mid"
    ? "Sitcom Energy™"
    : tier === "low"
    ? "Indie Romcom™"
    : "Sweet™";
}

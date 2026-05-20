// Shared types for the Spill The Tea™ composer flow.
// Safe to import from both client and server.

export type ChatRole = "user" | "ai" | "system";

export type ChatAttachment = {
  url: string;
  kind: "image" | "video" | "audio";
  name?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  attachments?: ChatAttachment[];
  question?: AiQuestion;
  created_at: string;
};

export type AiQuestion =
  | { type: "text"; placeholder?: string }
  | { type: "tap"; options: { id: string; label: string }[] }
  | { type: "multi"; options: { id: string; label: string }[] }
  | {
      type: "slider";
      min?: number;
      max?: number;
      minLabel?: string;
      maxLabel?: string;
    };

export type SpillExtracted = {
  relationship_type?:
    | "marriage"
    | "dating"
    | "breakup"
    | "situationship"
    | "family"
    | "other";
  themes?: string[];
  emotion?: "sad" | "angry" | "confused" | "hopeful" | "numb" | "shocked";
  intensity?: number; // 0..100 emotional exhaustion
  red_flags?: string[];
  green_flags?: string[];
  key_quotes?: string[];
};

export type ToneVariant = {
  tone: "funny" | "honest" | "petty";
  title: string;
  story: string;
  hashtags: string[];
  badges: string[];
};

export type SpillDraftRow = {
  id: string;
  user_id: string;
  status:
    | "chatting"
    | "scoring"
    | "drafting"
    | "previewing"
    | "published"
    | "abandoned";
  locale: string;
  raw_dump: string | null;
  chat_messages: ChatMessage[];
  extracted: SpillExtracted;
  media: ChatAttachment[];
  ready_for_score: boolean;
  score: number | null;
  subscores: Record<string, number> | null;
  category: string | null;
  category_key: string | null;
  rankings: { city?: number; country?: number; world?: number } | null;
  draft_variants: ToneVariant[] | null;
  selected_tone: ToneVariant["tone"] | null;
  selected_title: string | null;
  selected_story: string | null;
  cover_url: string | null;
  cover_kind: string | null;
  final_post_id: string | null;
  created_at: string;
  updated_at: string;
};

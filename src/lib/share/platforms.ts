// Multi-platform share intent builder. Client-safe.
import type { PlatformCaptions, SharePlatform } from "@/lib/posts/types";

export type ShareIntent =
  | { kind: "url"; url: string; caption?: string }
  | { kind: "copy"; caption: string; toast: "copied" | "captionCopied" }
  | { kind: "download"; caption: string; imageUrl: string | null };

export type ShareInput = {
  postId: string;
  origin: string; // e.g. https://shutap.lovable.app
  title: string;
  score: number;
  captions: PlatformCaptions;
  shareImage: string | null;
  ctaText: string;
};

function shortLink(origin: string, postId: string, platform: SharePlatform) {
  return `${origin}/s/${postId}?ref=${platform}`;
}

function withCta(caption: string | undefined, link: string, cta: string, fallback: string) {
  const base = (caption ?? fallback).trim();
  return `${base}\n\n${cta} → ${link}`;
}

export function buildShareIntent(platform: SharePlatform, input: ShareInput): ShareIntent {
  const link = shortLink(input.origin, input.postId, platform);
  const fallback = `${input.title} — ${input.score}/1000 Shutap Score™`;

  switch (platform) {
    case "x": {
      const text = withCta(input.captions.x, link, input.ctaText, fallback);
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      return { kind: "url", url };
    }
    case "facebook": {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
      return { kind: "url", url };
    }
    case "whatsapp": {
      const text = withCta(input.captions.whatsapp, link, input.ctaText, fallback);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      return { kind: "url", url };
    }
    case "imessage": {
      const text = withCta(input.captions.imessage, link, input.ctaText, fallback);
      // iOS uses sms:&body=, Android uses sms:?body= — & works on both via encoding
      const url = `sms:&body=${encodeURIComponent(text)}`;
      return { kind: "url", url };
    }
    case "copy_link": {
      return { kind: "copy", caption: link, toast: "copied" };
    }
    case "instagram":
    case "tiktok":
    case "xiaohongshu": {
      const cap = input.captions[platform];
      const text = withCta(cap, link, input.ctaText, fallback);
      return { kind: "download", caption: text, imageUrl: input.shareImage };
    }
  }
}

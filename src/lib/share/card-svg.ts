// Pure SVG builder for share cards. Client + server safe.
// Three formats designed for the major social surfaces.

import { scoreTier } from "@/lib/posts/types";

export type ShareCardFormat = "square" | "vertical" | "xhs";

export const SHARE_CARD_DIMENSIONS: Record<ShareCardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },   // X / Instagram feed
  vertical: { w: 1080, h: 1920 }, // TikTok / Stories / Reels
  xhs: { w: 1242, h: 1660 },      // Xiaohongshu
};

type Tier = ReturnType<typeof scoreTier>;

// One calm cream → peach gradient for every tier. Coral does the talking.
const CARD_GRADIENT: [string, string] = ["#FFFDF9", "#FFE9D6"];
const CORAL = "#E8602A";
const INK = "#1A1410";
const INK_SOFT = "rgba(26,20,16,0.6)";
// Kept for type compatibility; unused at runtime.
const TIER_GRADIENTS: Record<Tier, [string, string]> = {
  legendary: CARD_GRADIENT,
  high: CARD_GRADIENT,
  mid: CARD_GRADIENT,
  low: CARD_GRADIENT,
  sweet: CARD_GRADIENT,
};

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

// Naive line-wrapper: breaks text into lines that fit roughly `maxChars` characters.
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? current + " " + w : w;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > maxChars) lines[maxLines - 1] = last.slice(0, maxChars - 1) + "…";
  }
  return lines;
}

export interface ShareCardInput {
  format: ShareCardFormat;
  score: number;
  category: string;
  title: string;
  badges: string[];
  domain?: string;
  postId?: string;
}

export function buildShareCardSVG(input: ShareCardInput): string {
  const { w, h } = SHARE_CARD_DIMENSIONS[input.format];
  const tier = scoreTier(input.score);
  const [c1, c2] = TIER_GRADIENTS[tier];
  const domain = input.domain ?? "shutap.lovable.app";

  const padX = Math.round(w * 0.07);
  const padY = Math.round(h * 0.07);

  // Sizing scales per format
  const scoreSize = Math.round(Math.min(w, h) * 0.32);
  const titleSize = Math.round(w * (input.format === "vertical" ? 0.055 : 0.05));
  const labelSize = Math.round(w * 0.028);
  const catSize = Math.round(w * 0.035);

  const titleLines = wrap(input.title, input.format === "vertical" ? 28 : 26, 3);
  const titleLineHeight = Math.round(titleSize * 1.15);

  const badgeFont = Math.round(w * 0.022);
  const badgePadX = Math.round(badgeFont * 0.9);
  const badgePadY = Math.round(badgeFont * 0.5);

  // Layout anchors
  const labelY = padY + labelSize;
  const scoreCenterY = Math.round(h * (input.format === "square" ? 0.42 : 0.38));
  const catY = scoreCenterY + Math.round(scoreSize * 0.55) + catSize + 8;
  const titleStartY = catY + Math.round(catSize * 2.4);
  const footerY = h - padY;

  // Title lines (serif, ink)
  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${padX}" y="${titleStartY + i * titleLineHeight}" font-size="${titleSize}" font-weight="400" fill="${INK}" font-family="${TITLE_FONT}">${escapeXml(line)}</text>`,
    )
    .join("");

  // Badges
  let badgeX = padX;
  const badgeY = titleStartY + titleLines.length * titleLineHeight + Math.round(titleLineHeight * 0.6);
  const badgeH = badgeFont + badgePadY * 2;
  const badgesSvg = input.badges
    .slice(0, 3)
    .map((b) => {
      const txt = escapeXml(b);
      const approxW = Math.round(b.length * badgeFont * 0.62) + badgePadX * 2;
      const node = `
        <g>
          <rect x="${badgeX}" y="${badgeY}" rx="${badgeH / 2}" ry="${badgeH / 2}"
                width="${approxW}" height="${badgeH}"
                fill="rgba(232,96,42,0.10)" stroke="rgba(232,96,42,0.35)" stroke-width="1.5"/>
          <text x="${badgeX + badgePadX}" y="${badgeY + badgeFont + badgePadY * 0.55}"
                font-size="${badgeFont}" font-weight="600" fill="${CORAL}" font-family="${BODY_FONT}">${txt}</text>
        </g>`;
      badgeX += approxW + Math.round(badgeFont * 0.6);
      return node;
    })
    .join("");

  const watermark = `shutap.lovable.app · scan yours →`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#bg)"/>

  <text x="${padX}" y="${labelY}" font-size="${labelSize}" font-weight="600"
        letter-spacing="3" fill="${INK_SOFT}" font-family="${BODY_FONT}">
    SHUTAP CHAOS SCORE™
  </text>

  <text x="${w / 2}" y="${scoreCenterY}" text-anchor="middle" font-size="${scoreSize}"
        font-weight="900" fill="${CORAL}" font-family="${BODY_FONT}">${input.score}</text>
  <text x="${w / 2}" y="${scoreCenterY + Math.round(scoreSize * 0.18)}" text-anchor="middle"
        font-size="${labelSize}" fill="${INK_SOFT}" font-family="${BODY_FONT}">/ 1000</text>

  <g>
    <rect x="${w / 2 - Math.round(input.category.length * catSize * 0.42)}"
          y="${catY - catSize}"
          width="${Math.round(input.category.length * catSize * 0.84) + catSize}"
          height="${Math.round(catSize * 1.6)}"
          rx="${Math.round(catSize * 0.9)}"
          fill="rgba(232,96,42,0.14)" stroke="rgba(232,96,42,0.35)" stroke-width="1.5"/>
    <text x="${w / 2}" y="${catY}" text-anchor="middle" font-size="${catSize}" font-weight="600"
          fill="${CORAL}" font-family="${BODY_FONT}">${escapeXml(input.category)}</text>
  </g>

  ${titleSvg}
  ${badgesSvg}

  <text x="${padX}" y="${footerY}" font-size="${labelSize}" font-weight="500"
        fill="${INK_SOFT}" font-family="${BODY_FONT}">${escapeXml(watermark)}</text>
  <text x="${w - padX}" y="${footerY}" text-anchor="end" font-size="${labelSize}" font-weight="500"
        fill="${INK_SOFT}" font-family="${BODY_FONT}">${escapeXml(domain)}</text>
</svg>`;
}

const TITLE_FONT =
  "'DM Serif Display',Georgia,'Noto Serif SC',serif";
const BODY_FONT =
  "'DM Sans',system-ui,-apple-system,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";

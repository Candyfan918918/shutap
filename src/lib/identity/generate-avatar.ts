// Pure procedural avatar — returns an SVG data URI. Zero external calls.
// Same seed + vibe → same avatar. Browser- and server-safe.
import type { Vibe } from "@/lib/identity/descriptor-pools";
import { cityMonogram } from "@/lib/identity/city-pools";

const PALETTE: Record<Vibe, [string, string, string]> = {
  // [bgStart, bgEnd, accent]
  elegant:  ["#0f1020", "#2a1450", "#e8c97a"],
  wild:     ["#1a0010", "#7a0030", "#ff3d6e"],
  soft:     ["#1f1530", "#3a2552", "#f8b6d0"],
  sharp:    ["#080808", "#1a1a1a", "#ff5a3c"],
  dreamy:   ["#0a1432", "#3a1d6a", "#8ec5ff"],
  royal:    ["#0a0014", "#2a0050", "#c9a84c"],
  playful:  ["#240046", "#7b1fa2", "#ffd166"],
};

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Base64-encode without Buffer (works in browser + Cloudflare Worker SSR)
function toBase64(str: string): string {
  if (typeof btoa === "function") {
    // Encode multi-byte chars safely
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  // Node fallback
  return Buffer.from(str, "utf-8").toString("base64");
}

export interface AvatarInput {
  vibe: Vibe;
  cityLabel: string;
  seed: string; // typically `${userId}:${rerollSeed}`
}

export function generateAvatarSVG(input: AvatarInput): string {
  const [bg1, bg2, accent] = PALETTE[input.vibe] ?? PALETTE.dreamy;
  const monogram = cityMonogram(input.cityLabel);
  const rand = seededRand(hash(input.seed));

  // 2 large orbs + sparkles for ornament
  const orb1 = { x: Math.round(rand() * 360 + 80), y: Math.round(rand() * 360 + 80), r: Math.round(rand() * 150 + 120) };
  const orb2 = { x: Math.round(rand() * 360 + 80), y: Math.round(rand() * 360 + 80), r: Math.round(rand() * 120 + 80) };
  const sparkles = Array.from({ length: 6 }).map(() => ({
    x: Math.round(rand() * 480 + 16),
    y: Math.round(rand() * 480 + 16),
    r: Math.round(rand() * 4 + 1),
    o: (rand() * 0.5 + 0.2).toFixed(2),
  }));

  const fontSize = monogram.length > 1 ? 220 : 280;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="o1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="o2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="${orb1.x}" cy="${orb1.y}" r="${orb1.r}" fill="url(#o1)"/>
  <circle cx="${orb2.x}" cy="${orb2.y}" r="${orb2.r}" fill="url(#o2)"/>
  ${sparkles.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#fff" opacity="${s.o}"/>`).join("")}
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
        font-weight="800" font-size="${fontSize}" fill="#ffffff"
        style="paint-order:stroke;stroke:rgba(0,0,0,0.25);stroke-width:6">${escapeXml(monogram)}</text>
</svg>`;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

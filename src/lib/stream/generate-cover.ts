// Procedural SVG cover for stream story cards when no upload exists.
// Deterministic: same seed + category → identical cover. Browser + Worker safe.

const PALETTES: Record<string, [string, string, string, string]> = {
  // [from, mid, to, accent]
  family:   ["#fde7f0", "#f6c1d3", "#e89bb6", "#a83d6b"],
  work:     ["#fff4d1", "#fbe08a", "#e9bd4f", "#7a5210"],
  stranger: ["#ffe6df", "#ffb7a6", "#e8826b", "#7a2e1d"],
  digital:  ["#ece5fa", "#c8b8f1", "#9c83df", "#3f2a8a"],
  friend:   ["#defaf0", "#aae6cf", "#5fbf9d", "#0e5a3e"],
  romance:  ["#ffe1ec", "#ffb3cd", "#ec7aa6", "#8a1f4d"],
};

function paletteFor(category: string | null): [string, string, string, string] {
  const c = (category ?? "").toLowerCase();
  if (c.includes("famil") || c.includes("mother") || c.includes("mil")) return PALETTES.family;
  if (c.includes("work") || c.includes("money")) return PALETTES.work;
  if (c.includes("stranger") || c.includes("neigh")) return PALETTES.stranger;
  if (c.includes("digital") || c.includes("online")) return PALETTES.digital;
  if (c.includes("friend")) return PALETTES.friend;
  return PALETTES.romance;
}

function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function toBase64(str: string): string {
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return Buffer.from(str, "utf-8").toString("base64");
}

export interface CoverInput {
  seed: string;
  category: string | null;
  emoji?: string | null;
}

export function generateStoryCoverSVG({ seed, category, emoji }: CoverInput): string {
  const [from, mid, to, accent] = paletteFor(category);
  const r = rand(hash(seed));
  const W = 400;
  const H = 500;

  const orb1 = { x: r() * W, y: r() * H * 0.6, rr: r() * 140 + 100 };
  const orb2 = { x: r() * W, y: H * 0.5 + r() * H * 0.5, rr: r() * 120 + 80 };
  const blob = `M${Math.round(r() * 80)},${Math.round(r() * 80 + 60)} ` +
    `Q${Math.round(W * 0.5 + r() * 60)},${Math.round(r() * 100)} ` +
    `${Math.round(W - r() * 60)},${Math.round(H * 0.4 + r() * 80)} ` +
    `T${Math.round(r() * 120)},${Math.round(H - r() * 60)} Z`;

  const sparkles = Array.from({ length: 7 }).map(() => ({
    x: Math.round(r() * W),
    y: Math.round(r() * H),
    rr: r() * 2.5 + 0.8,
    o: (r() * 0.4 + 0.25).toFixed(2),
  }));

  const glyph = (emoji ?? "✦").trim() || "✦";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/>
    <stop offset="55%" stop-color="${mid}"/>
    <stop offset="100%" stop-color="${to}"/>
  </linearGradient>
  <radialGradient id="o1"><stop offset="0%" stop-color="#fff" stop-opacity="0.55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="o2"><stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<path d="${blob}" fill="${accent}" fill-opacity="0.10"/>
<circle cx="${orb1.x}" cy="${orb1.y}" r="${orb1.rr}" fill="url(#o1)"/>
<circle cx="${orb2.x}" cy="${orb2.y}" r="${orb2.rr}" fill="url(#o2)"/>
${sparkles.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.rr}" fill="#fff" opacity="${s.o}"/>`).join("")}
<text x="${W / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="central"
  font-size="160" font-family="system-ui, -apple-system, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
  opacity="0.92">${escapeXml(glyph)}</text>
</svg>`;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

// Horizontal bars of share counts by platform.
const ICONS: Record<string, string> = {
  x: "𝕏",
  tiktok: "🎵",
  instagram: "📸",
  xiaohongshu: "📕",
  facebook: "👍",
  imessage: "💬",
  whatsapp: "💚",
  copy_link: "🔗",
  friend: "🫂",
};
const LABELS: Record<string, string> = {
  x: "X / Twitter",
  tiktok: "TikTok",
  instagram: "Instagram",
  xiaohongshu: "Xiaohongshu",
  facebook: "Facebook",
  imessage: "iMessage",
  whatsapp: "WhatsApp",
  copy_link: "Copied link",
  friend: "Sent to friend",
};

export function SharePlatformBars({ rows, title }: { rows: Array<{ k: string; count: number }>; title: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-surface-elevated border border-border p-4">
        <div className="text-xs text-muted-foreground mb-2">{title}</div>
        <div className="text-sm text-muted-foreground">no data yet 👀</div>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl bg-surface-elevated border border-border p-4">
      <div className="text-xs text-muted-foreground mb-3">{title}</div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center gap-3 text-sm">
            <span className="w-32 truncate">{ICONS[r.k] ?? "·"} {LABELS[r.k] ?? r.k}</span>
            <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SharePlatformBarsPlatform({ rows }: { rows: Array<{ platform: string; count: number }> }) {
  return <SharePlatformBars title="shares by platform" rows={rows.map((r) => ({ k: r.platform, count: r.count }))} />;
}
export function SharePlatformBarsChannel({ rows }: { rows: Array<{ channel: string; count: number }> }) {
  return <SharePlatformBars title="forwarded via" rows={rows.map((r) => ({ k: r.channel, count: r.count }))} />;
}

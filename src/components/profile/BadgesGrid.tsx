// Grid of achievement badges.
import type { Badge } from "@/lib/badges";

export function BadgesGrid({ badges }: { badges: Badge[] }) {
  if (!badges.length) {
    return (
      <div className="px-8 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-3">🏆</div>
        <div>no badges yet</div>
        <div className="text-sm mt-1">earn them by posting, scanning, getting likes.</div>
      </div>
    );
  }
  return (
    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {badges.map((b) => (
        <div key={b.id} className="rounded-2xl bg-card border border-border p-4 text-center hover:border-primary/40 transition">
          <div className="text-4xl mb-2">{b.emoji}</div>
          <div className="font-semibold text-sm">{b.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
        </div>
      ))}
    </div>
  );
}

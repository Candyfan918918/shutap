import { Link } from "@tanstack/react-router";
import type { HonorBadge as HonorBadgeT } from "@/lib/court.functions";

const BADGE_META: Record<string, { emoji: string; label: string }> = {
  court_featured: { emoji: "👑", label: "Court Featured" },
  world_court: { emoji: "🌎", label: "World Court" },
  viral_case: { emoji: "🔥", label: "Viral Case" },
  public_debate: { emoji: "⚖️", label: "Public Debate" },
  final_verdict_run: { emoji: "🏃", label: "Verdict: Run" },
  final_verdict_red_flag: { emoji: "🚩", label: "Verdict: Red Flag" },
  final_verdict_green_flag: { emoji: "💚", label: "Verdict: Green Flag" },
  final_verdict_talk: { emoji: "🗣", label: "Verdict: Talk It Out" },
};

export function HonorBadge({ b, onPin }: { b: HonorBadgeT; onPin?: (id: string) => void }) {
  const meta = BADGE_META[b.badgeKind] ?? { emoji: "🏆", label: b.badgeKind };
  return (
    <div
      className={`group relative rounded-2xl border ${
        b.pinned ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      } p-3 flex items-center gap-3 hover:border-primary/40 transition`}
    >
      <div className="text-2xl">{meta.emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold truncate">{meta.label}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {b.regionLabel} · {new Date(b.earnedAt).toLocaleDateString()}
        </div>
        {b.post && (
          <Link
            to="/post/$postId"
            params={{ postId: b.post.id }}
            search={{ shared: 2 }}
            className="text-[11px] text-primary underline truncate inline-block max-w-full"
          >
            {b.post.title}
          </Link>
        )}
      </div>
      {onPin && (
        <button
          onClick={() => onPin(b.id)}
          className={`text-[10px] px-2 py-1 rounded-full border transition ${
            b.pinned
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          {b.pinned ? "📌 Pinned" : "📍 Pin"}
        </button>
      )}
    </div>
  );
}

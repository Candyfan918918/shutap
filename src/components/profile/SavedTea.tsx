// Saved posts grid.
import { Link } from "@tanstack/react-router";
import type { SavedPostRow } from "@/lib/saved.functions";

export function SavedTea({ rows, isMe }: { rows: SavedPostRow[]; isMe: boolean }) {
  if (!isMe) {
    return <div className="p-8 text-center text-muted-foreground">🔒 saved tea is private.</div>;
  }
  if (!rows.length) {
    return (
      <div className="px-8 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-3">🔖</div>
        <div>Nothing saved. Nothing worth returning to yet.</div>
        <div className="text-sm mt-1">bookmark posts that hit different.</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3">
      {rows.map((p) => (
        <Link
          key={p.id}
          to="/post/$postId"
          params={{ postId: p.id }}
          search={{ shared: 0 }}
          className="block rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated grid place-items-center text-xl shrink-0">
              {p.media_url ? <img src={p.media_url} alt="" className="w-full h-full object-cover rounded-xl" /> : "☕"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">@{p.author_handle}</div>
              <div className="text-sm text-foreground/80 line-clamp-2 mt-1">{p.story_text}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

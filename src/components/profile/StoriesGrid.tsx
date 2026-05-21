// Grid of public stories on the profile.
import { Link } from "@tanstack/react-router";
import type { PublicPostRow } from "@/lib/posts/public.functions";

export function StoriesGrid({ posts, isMe }: { posts: PublicPostRow[]; isMe: boolean }) {
  if (!posts.length) {
    return (
      <div className="px-8 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-3">👀</div>
        <div className="text-base">no chaos posted yet</div>
        <div className="text-sm mt-1">either peaceful… or hiding something.</div>
        {isMe && (
          <Link
            to="/spill"
            className="inline-block mt-6 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm"
          >
            ☕ Spill the tea
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 p-1 sm:p-2">
      {posts.map((p) => (
        <Link
          key={p.id}
          to="/post/$postId"
          params={{ postId: p.id }}
          search={{ shared: 0 }}
          className="relative aspect-[3/4] rounded-md overflow-hidden bg-surface-elevated border border-border group"
        >
          {p.media_url ? (
            <img src={p.media_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center text-2xl">
              {p.score && p.score >= 700 ? "🔥" : p.score && p.score < 300 ? "💚" : "☕"}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <div className="text-[10px] text-white/90 flex items-center gap-2">
              <span>👁 {(p.view_count ?? 0).toLocaleString()}</span>
              <span>❤️ {p.like_count}</span>
            </div>
            <div className="text-xs font-semibold text-white line-clamp-2 mt-0.5">{p.title}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

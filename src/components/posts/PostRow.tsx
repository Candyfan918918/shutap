// Row card for a post in the manager.
import { Link } from "@tanstack/react-router";
import { VisibilityBadge } from "./VisibilityBadge";
import { PostRowMenu } from "./PostRowMenu";
import type { MyPostRow } from "@/lib/posts-manage.functions";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export function PostRow({ post, onChanged }: { post: MyPostRow; onChanged: () => void }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 flex gap-4">
      <Link
        to="/me/posts/$postId"
        params={{ postId: post.id }}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Open ${post.title}`}
      />
      <div className="relative w-16 h-16 rounded-xl bg-surface-elevated border border-border overflow-hidden shrink-0 grid place-items-center text-2xl">
        {post.media_url ? (
          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{post.score && post.score >= 700 ? "🔥" : post.score && post.score < 300 ? "💚" : "☕"}</span>
        )}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold truncate">{post.title}</div>
          <div className="relative z-10 shrink-0">
            <PostRowMenu post={post} onChanged={onChanged} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          {post.score !== null && <span>🚨 {post.score}</span>}
          <span>👁 {post.view_count.toLocaleString()}</span>
          <span>❤️ {post.like_count}</span>
          <span>🔁 {post.share_count}</span>
          <span>🔖 {post.save_count}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <VisibilityBadge visibility={post.visibility} />
          <span>· {post.status === "draft" ? "draft" : `published ${timeAgo(post.published_at)} ago`}</span>
        </div>
      </div>
    </div>
  );
}

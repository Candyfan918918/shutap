// Public profile header.
import { Link } from "@tanstack/react-router";
import type { PublicProfile } from "@/lib/profile.functions";
import { FollowButton } from "./FollowButton";
import { FriendButton } from "./FriendButton";

function stat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function ProfileHeader({ p, onChanged }: { p: PublicProfile; onChanged: () => void }) {
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-surface-elevated border border-border grid place-items-center text-3xl shrink-0">
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : "👤"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-lg font-bold truncate">{p.displayName}</div>
              <div className="text-sm text-muted-foreground">@{p.handle}</div>
            </div>
            {p.isMe ? (
              <Link
                to="/settings/identity"
                className="px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm font-semibold"
              >
                Edit profile
              </Link>
            ) : (
              <div className="flex gap-2">
                <FollowButton targetUserId={p.id} isFollowing={p.isFollowing} onChanged={onChanged} />
                <FriendButton targetUserId={p.id} state={p.friendship} onChanged={onChanged} />
              </div>
            )}
          </div>

          {p.bio && <div className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">{p.bio}</div>}
          {p.cityLabel && (
            <div className="mt-2 text-xs text-muted-foreground">📍 {p.cityLabel}</div>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div><span className="font-bold tabular-nums">{stat(p.postCount)}</span> <span className="text-muted-foreground">posts</span></div>
            <div><span className="font-bold tabular-nums">{stat(p.followerCount)}</span> <span className="text-muted-foreground">followers</span></div>
            <div><span className="font-bold tabular-nums">{stat(p.followingCount)}</span> <span className="text-muted-foreground">following</span></div>
          </div>

          {(p.avgScore > 0 || p.maxScore > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.avgScore > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary">
                  🚨 avg chaos {p.avgScore}
                </span>
              )}
              {p.maxScore >= 700 && (
                <span className="text-xs px-2 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent">
                  👑 peak {p.maxScore}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

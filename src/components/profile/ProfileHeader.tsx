// Public profile header — Shutap vocabulary only. No followers/likes/posts copy.
import { Link } from "@tanstack/react-router";
import type { PublicProfile } from "@/lib/profile.functions";
import { FollowButton } from "./FollowButton";
import { FriendButton } from "./FriendButton";

function stat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium tabular-nums text-foreground">{stat(value)}</span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

export function ProfileHeader({ p, onChanged }: { p: PublicProfile; onChanged: () => void }) {
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-surface-elevated border border-border grid place-items-center text-4xl sm:text-5xl shrink-0">
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
            : (p.emoji ?? "👤")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-lg font-medium truncate">{p.displayName}</div>
              <div className="text-sm text-muted-foreground">@{p.handle}</div>
            </div>
            {p.isMe ? (
              <Link
                to="/settings/identity"
                className="px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm font-medium"
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

          {/* Alias profile stats row — Shutap vocabulary. */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatItem value={p.postCount} label="cases brought" />
            <StatItem value={p.counselCount} label="counsel given" />
            <StatItem value={p.courtAppearances} label="Court appearances" />
            <StatItem value={p.outcomesTracked} label="outcomes tracked" />
          </div>

          {/* Community trust — tier, never a number. */}
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent">
              ⚖️ {p.trustTier}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

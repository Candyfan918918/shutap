// Follow / Following button.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/lib/social.functions";

export function FollowButton({ targetUserId, isFollowing, onChanged }: {
  targetUserId: string;
  isFollowing: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState(isFollowing);
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);

  const toggle = async () => {
    setBusy(true);
    const next = !optimistic;
    setOptimistic(next);
    try {
      if (next) await follow({ data: { userId: targetUserId } });
      else await unfollow({ data: { userId: targetUserId } });
      onChanged();
    } catch (e) {
      setOptimistic(!next);
      toast.error(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
        optimistic
          ? "bg-surface-elevated border border-border"
          : "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md"
      } disabled:opacity-50`}
    >
      {optimistic ? "Following" : "Follow"}
    </button>
  );
}

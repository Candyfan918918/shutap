// Friend request button.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sendFriendRequest, respondFriendRequest, removeFriend } from "@/lib/social.functions";

type State = "none" | "pending_out" | "pending_in" | "accepted" | "declined";

export function FriendButton({ targetUserId, state, onChanged }: {
  targetUserId: string;
  state: State;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendFriendRequest);
  const respond = useServerFn(respondFriendRequest);
  const remove = useServerFn(removeFriend);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setBusy(false); }
  };

  if (state === "accepted") {
    return (
      <button
        onClick={() => run(() => remove({ data: { userId: targetUserId } }), "unfriended")}
        disabled={busy}
        className="px-3 py-2 rounded-full text-sm font-medium bg-surface-elevated border border-border disabled:opacity-50"
      >
        🫂 Friends
      </button>
    );
  }
  if (state === "pending_out") {
    return (
      <button
        disabled
        className="px-3 py-2 rounded-full text-sm font-medium bg-surface-elevated border border-border opacity-60"
      >
        ⏳ Pending
      </button>
    );
  }
  if (state === "pending_in") {
    return (
      <button
        onClick={() => run(() => respond({ data: { requesterId: targetUserId, accept: true } }), "friends now 🫂")}
        disabled={busy}
        className="px-3 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white disabled:opacity-50"
      >
        ✓ Accept
      </button>
    );
  }
  return (
    <button
      onClick={() => run(() => send({ data: { userId: targetUserId } }), "request sent. now we wait like it's 2009.")}
      disabled={busy}
      className="px-3 py-2 rounded-full text-sm font-medium bg-surface-elevated border border-border hover:border-primary/60 disabled:opacity-50"
    >
      ➕ Friend
    </button>
  );
}

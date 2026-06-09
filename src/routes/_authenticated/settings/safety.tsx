// Safety: blocked list.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listBlocked, unblockUser } from "@/lib/social.functions";

export const Route = createFileRoute("/_authenticated/settings/safety")({
  component: SafetyPage,
});

function SafetyPage() {
  const list = useServerFn(listBlocked);
  const unblock = useServerFn(unblockUser);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["blocks"], queryFn: () => list() });

  const onUnblock = async (userId: string) => {
    try { await unblock({ data: { userId } }); toast.success("unblocked"); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Safety</h2>
        <p className="text-sm text-muted-foreground">Manage blocked accounts and report users from their profile.</p>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {isLoading && <div className="px-4 py-6 text-sm text-muted-foreground">loading…</div>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="px-4 py-6 text-sm text-muted-foreground">No one blocked. peaceful era ✨</div>
        )}
        {(data ?? []).map((u) => (
          <div key={u.userId} className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-elevated grid place-items-center overflow-hidden">
              {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt="" /> : "👤"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">{u.displayName}</div>
              <div className="text-xs text-muted-foreground">@{u.handle}</div>
            </div>
            <button
              onClick={() => onUnblock(u.userId)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/40"
            >
              Unblock
            </button>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        🛡️ Content controls and reporting flows are integrated on each post. Long-press a post to report it.
      </div>
    </div>
  );
}

// /admin/mod-queue — review paused candidacy.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listModQueue,
  resolveQueueItem,
  type ModQueueItem,
  type ModStatus,
} from "@/lib/admin/modQueue.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/mod-queue")({
  component: ModQueuePage,
});

const REASON_LABEL: Record<string, string> = {
  pii_suspected: "PII suspected",
  mass_flag: "Mass flag",
  legal_risk: "Legal risk",
  manual_hold: "Manual hold",
  rate_limited: "Rate limited",
};

function ModQueuePage() {
  const list = useServerFn(listModQueue);
  const resolve = useServerFn(resolveQueueItem);
  const [tab, setTab] = useState<ModStatus | "all">("pending");
  const [items, setItems] = useState<ModQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = (s = tab) =>
    list({ data: { status: s } })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    refresh(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-md border ${
              tab === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface-elevated border-border hover:border-primary/40"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Pulling queue.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Queue is empty. The peace holds.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300">
                  {REASON_LABEL[it.reason] ?? it.reason}
                </span>
                <span className="text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">·</span>
                <span className="capitalize text-muted-foreground">{it.status}</span>
              </div>
              {it.post ? (
                <>
                  <Link
                    to="/post/$postId"
                    params={{ postId: it.postId }}
                    search={{ shared: 2 }}
                    className="block font-medium hover:underline"
                  >
                    {it.post.title}
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {it.post.storyText}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Post unavailable.</p>
              )}
              {it.notes && (
                <p className="text-xs text-muted-foreground italic">Notes: {it.notes}</p>
              )}
              {it.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={busy === it.id}
                    onClick={async () => {
                      setBusy(it.id);
                      try {
                        await resolve({ data: { id: it.id, decision: "approved" } });
                        toast.success("Approved.");
                        await refresh(tab);
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === it.id}
                    onClick={async () => {
                      const notes = window.prompt("Rejection note (optional)?") ?? undefined;
                      setBusy(it.id);
                      try {
                        await resolve({ data: { id: it.id, decision: "rejected", notes } });
                        toast.success("Rejected.");
                        await refresh(tab);
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

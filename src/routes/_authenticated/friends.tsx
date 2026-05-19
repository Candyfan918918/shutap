// Friends inbox.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { listFriendInbox, respondFriendRequest, removeFriend } from "@/lib/social.functions";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
  head: () => ({ meta: [{ title: "Friends" }] }),
});

function FriendsPage() {
  const fetch = useServerFn(listFriendInbox);
  const respond = useServerFn(respondFriendRequest);
  const remove = useServerFn(removeFriend);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["friend_inbox"], queryFn: () => fetch() });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
  };

  const incoming = (data ?? []).filter((r) => r.state === "pending_in");
  const outgoing = (data ?? []).filter((r) => r.state === "pending_out");
  const accepted = (data ?? []).filter((r) => r.state === "accepted");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/me" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-semibold">Friends</div>
          <span className="w-6" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24 space-y-8">
        {isLoading && <div className="text-muted-foreground">loading…</div>}

        {incoming.length > 0 && (
          <Section title={`Requests (${incoming.length})`}>
            {incoming.map((r) => (
              <Row key={r.userId} r={r}>
                <button
                  onClick={() => run(() => respond({ data: { requesterId: r.userId, accept: true } }), "friends now 🫂")}
                  className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => run(() => respond({ data: { requesterId: r.userId, accept: false } }), "declined")}
                  className="px-3 py-1.5 rounded-full bg-surface-elevated text-xs font-semibold border border-border"
                >
                  Decline
                </button>
              </Row>
            ))}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section title="Pending">
            {outgoing.map((r) => (
              <Row key={r.userId} r={r}>
                <span className="text-xs text-muted-foreground">waiting like it's 2009…</span>
              </Row>
            ))}
          </Section>
        )}

        <Section title={`Friends (${accepted.length})`}>
          {accepted.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No friends yet. Send a request from someone's profile.</div>
          ) : accepted.map((r) => (
            <Row key={r.userId} r={r}>
              <button
                onClick={() => run(() => remove({ data: { userId: r.userId } }), "unfriended")}
                className="px-3 py-1.5 rounded-full bg-surface-elevated text-xs font-semibold border border-border"
              >
                Remove
              </button>
            </Row>
          ))}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ r, children }: { r: { userId: string; handle: string; displayName: string; avatarUrl: string | null }; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Link to="/u/$handle" params={{ handle: r.handle }} className="w-10 h-10 rounded-full bg-surface-elevated grid place-items-center overflow-hidden shrink-0">
        {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : "👤"}
      </Link>
      <Link to="/u/$handle" params={{ handle: r.handle }} className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm">{r.displayName}</div>
        <div className="text-xs text-muted-foreground">@{r.handle}</div>
      </Link>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

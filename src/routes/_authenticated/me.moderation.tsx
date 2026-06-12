import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyModerationStories, type MyModerationStory } from "@/lib/moderationState.functions";

const myModerationQO = (fn: () => Promise<{ data: MyModerationStory[]; error: string | null }>) =>
  queryOptions({
    queryKey: ["me", "moderation-state"],
    queryFn: async () => {
      const res = await fn();
      if (res.error) throw new Error(res.error);
      return res.data;
    },
  });

export const Route = createFileRoute("/_authenticated/me/moderation")({
  component: ModerationStatePage,
  pendingComponent: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-zinc-200">
        <p className="text-lg">The bench couldn't read your file.</p>
        <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
        <button
          className="mt-6 rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="px-4 py-16 text-zinc-400">Nothing here.</div>,
  head: () => ({
    meta: [
      { title: "Moderation state — Shutap" },
      { name: "description", content: "Live status of your stories before the bench." },
    ],
  }),
});

const LABEL: Record<string, string> = {
  pending: "Awaiting the bench",
  sensitive: "Flagged sensitive",
  removed: "Removed",
  disputed: "Disputed — in review",
  under_appeal: "Under appeal",
};

const TONE: Record<string, string> = {
  pending: "border-zinc-700 text-zinc-300",
  sensitive: "border-amber-700/60 text-amber-300",
  removed: "border-rose-800/60 text-rose-300",
  disputed: "border-sky-700/60 text-sky-300",
  under_appeal: "border-violet-700/60 text-violet-300",
};

function ModerationStatePage() {
  const fetchFn = useServerFn(listMyModerationStories);
  const qo = myModerationQO(fetchFn);
  const { data, refetch } = useSuspenseQuery(qo);
  const router = useRouter();

  // Realtime: any change to the user's own stories rerouts through invalidation.
  useEffect(() => {
    const channel = supabase
      .channel("me-moderation-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stories" },
        () => {
          refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories" },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-zinc-100">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Your file with the bench</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Status updates land here the moment they happen. No refresh required.
        </p>
      </header>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">No cases on the docket.</p>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {data.map((s) => {
            const tone = TONE[s.moderation_status] ?? TONE.pending;
            const label = LABEL[s.moderation_status] ?? s.moderation_status;
            return (
              <li key={s.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-200">
                    {s.title?.trim() || "Untitled"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {new Date(s.updated_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${tone}`}
                  aria-live="polite"
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => router.invalidate()}
        className="mt-10 text-xs text-zinc-600 hover:text-zinc-400"
      >
        Force resync
      </button>
    </div>
  );
}

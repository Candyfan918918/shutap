// My posts manager: /me/posts
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { listMyPosts, getMyPostCounts } from "@/lib/posts/manage.functions";
import { PostRow } from "@/components/posts/PostRow";

type Tab = "published" | "drafts" | "private";

export const Route = createFileRoute("/_authenticated/me/posts/")({
  component: MyPostsPage,
  head: () => ({ meta: [{ title: "My posts" }] }),
});

function MyPostsPage() {
  const [tab, setTab] = useState<Tab>("published");
  const list = useServerFn(listMyPosts);
  const counts = useServerFn(getMyPostCounts);

  const cQuery = useQuery({ queryKey: ["my_post_counts"], queryFn: () => counts() });
  const pQuery = useQuery({ queryKey: ["my_posts", tab], queryFn: () => list({ data: { tab } }) });

  const c = cQuery.data ?? { published: 0, drafts: 0, private: 0 };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85  border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/me" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-medium">Your posts</div>
          <Link to="/spill" className="p-1 text-primary"><Plus className="w-5 h-5" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-24">
        <div className="flex gap-2 mb-4">
          {(["published", "drafts", "private"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                tab === t
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-surface-elevated border-border"
              }`}
            >
              {t === "published" && "🌍 Published"}
              {t === "drafts" && "✏️ Drafts"}
              {t === "private" && "🔒 Private"}
              <span className="ml-1.5 text-xs opacity-70">{c[t]}</span>
            </button>
          ))}
        </div>

        {pQuery.isLoading ? (
          <div className="text-center text-muted-foreground py-12">loading…</div>
        ) : (pQuery.data ?? []).length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {(pQuery.data ?? []).map((p) => (
              <PostRow key={p.id} post={p} onChanged={() => { pQuery.refetch(); cQuery.refetch(); }} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy = {
    published: { emoji: "👀", title: "no chaos posted yet", sub: "either peaceful… or hiding something." },
    drafts: { emoji: "✏️", title: "no drafts", sub: "all spilled, nothing brewing." },
    private: { emoji: "🔒", title: "no private posts", sub: "everything's out there." },
  }[tab];
  return (
    <div className="text-center py-20 text-muted-foreground">
      <div className="text-6xl mb-3">{copy.emoji}</div>
      <div className="font-medium text-foreground">{copy.title}</div>
      <div className="text-sm mt-1">{copy.sub}</div>
      <Link
        to="/spill"
        className="mt-6 inline-block px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm"
      >
        ☕ Spill the tea
      </Link>
    </div>
  );
}

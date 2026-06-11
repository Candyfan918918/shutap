// Per-post analytics: /me/posts/$postId
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getPostAnalytics } from "@/lib/post-analytics.functions";
import { softDeletePost, setPostVisibility } from "@/lib/posts/manage.functions";
import { KpiTile } from "@/components/posts/KpiTile";
import { ViewsSparkline } from "@/components/posts/ViewsSparkline";
import { SharePlatformBarsPlatform, SharePlatformBarsChannel } from "@/components/posts/SharePlatformBars";
import { VisibilityBadge } from "@/components/posts/VisibilityBadge";
import { AuthorActionComposer } from "@/components/posts/AuthorActionComposer";

type ComposerAction = "update" | "sequel" | "close";
const COMPOSER_ACTIONS: ComposerAction[] = ["update", "sequel", "close"];

export const Route = createFileRoute("/_authenticated/me/posts/$postId/")({
  validateSearch: (s: Record<string, unknown>): { action?: ComposerAction } => {
    const a = typeof s.action === "string" ? s.action : undefined;
    return a && (COMPOSER_ACTIONS as string[]).includes(a)
      ? { action: a as ComposerAction }
      : {};
  },
  component: PostAnalyticsPage,
});

function PostAnalyticsPage() {
  const { postId } = Route.useParams();
  const { action } = Route.useSearch();
  const navigate = useNavigate();
  const fetchKpi = useServerFn(getPostAnalytics);
  const setVis = useServerFn(setPostVisibility);
  const del = useServerFn(softDeletePost);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["post_analytics", postId],
    queryFn: () => fetchKpi({ data: { postId } }),
  });

  const closeComposer = () =>
    navigate({ to: "/me/posts/$postId", params: { postId }, search: {} });

  if (isLoading || !data) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">The numbers are being tallied.</div>;
  }

  const changeVis = async (v: "public" | "private" | "friends") => {
    try { await setVis({ data: { postId, visibility: v } }); toast.success("updated"); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
  };

  const onDelete = async () => {
    if (!confirm("delete forever? the receipts will be wiped 🫥")) return;
    try { await del({ data: { postId } }); toast.success("gone 🫥"); navigate({ to: "/me/posts" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-30 bg-background/85  border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link to="/me/posts" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-medium text-sm truncate max-w-[60%]">{data.title}</div>
          <button onClick={onDelete} className="p-1 text-red-400" aria-label="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-surface-elevated grid place-items-center text-2xl shrink-0 overflow-hidden">
              {data.media_url ? <img src={data.media_url} alt="" className="w-full h-full object-cover" /> : "☕"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-medium">{data.title}</div>
              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{data.story_text}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                {data.score !== null && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">🚨 {data.score}</span>}
                <VisibilityBadge visibility={data.visibility} />
                {data.published_at && <span className="text-muted-foreground">· {new Date(data.published_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["public", "friends", "private"] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeVis(v)}
                disabled={data.visibility === v}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  data.visibility === v
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-surface-elevated border-border hover:border-primary/40"
                }`}
              >
                {v === "public" ? "🌍 public" : v === "friends" ? "🫂 friends" : "🔒 private"}
              </button>
            ))}
            <Link
              to="/me/posts/$postId/edit"
              params={{ postId }}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-surface-elevated hover:border-primary/40"
            >
              ✏️ edit
            </Link>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
                toast.success("link copied 🔗");
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-surface-elevated hover:border-primary/40"
            >
              🔗 copy link
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiTile icon="👁" label="views" value={data.views.toLocaleString()} />
          <KpiTile icon="❤️" label="likes" value={data.likes.toLocaleString()} />
          <KpiTile icon="💬" label="comments" value={data.comments.toLocaleString()} />
          <KpiTile icon="🔁" label="shares" value={data.shares.toLocaleString()} />
          <KpiTile icon="🔖" label="saves" value={data.saves.toLocaleString()} />
          <KpiTile icon="📤" label="forwards" value={data.forwards.toLocaleString()} />
        </div>

        <ViewsSparkline data={data.dailyViews} />
        <SharePlatformBarsPlatform rows={data.shareBreakdown} />
        <SharePlatformBarsChannel rows={data.forwardBreakdown} />
      </main>

      {action && (
        <AuthorActionComposer postId={postId} action={action} onClose={closeComposer} />
      )}
    </div>
  );
}

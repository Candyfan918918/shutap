// Edit post: /me/posts/$postId/edit
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getPostAnalytics } from "@/lib/post-analytics.functions";
import { editPost } from "@/lib/posts/manage.functions";

export const Route = createFileRoute("/_authenticated/me/posts/$postId/edit")({
  component: EditPostPage,
});

function EditPostPage() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const fetch = useServerFn(getPostAnalytics);
  const save = useServerFn(editPost);
  const { data } = useQuery({ queryKey: ["post_analytics", postId], queryFn: () => fetch({ data: { postId } }) });
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) { setTitle(data.title); setStory(data.story_text); }
  }, [data]);

  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: { postId, title, storyText: story } });
      toast.success("saved ✨");
      navigate({ to: "/me/posts/$postId", params: { postId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-30 bg-background/85  border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/me/posts/$postId" params={{ postId }} className="p-1 -ml-1 text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-medium">Edit post</div>
          <span className="w-6" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-4">
        <label className="block">
          <div className="text-xs text-muted-foreground mb-1">title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 160))}
            className="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary text-base"
          />
        </label>
        <label className="block">
          <div className="text-xs text-muted-foreground mb-1">story</div>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value.slice(0, 2000))}
            rows={10}
            className="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary text-base resize-y"
          />
          <div className="text-right text-xs text-muted-foreground mt-1">{story.length}/2000</div>
        </label>
        <button
          onClick={onSave}
          disabled={busy}
          className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-40"
        >
          {busy ? "saving…" : "save changes"}
        </button>
      </main>
    </div>
  );
}

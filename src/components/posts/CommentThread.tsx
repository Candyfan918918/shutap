import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addComment, listComments, deleteComment, type CommentRow } from "@/lib/posts/community.functions";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function CommentThread({ postId }: { postId: string }) {
  const fetchComments = useServerFn(listComments);
  const post = useServerFn(addComment);
  const del = useServerFn(deleteComment);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await fetchComments({ data: { postId, limit: 100 } });
      setComments(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!userId) { toast.message("Sign in to comment"); return; }
    setSubmitting(true);
    try {
      await post({ data: { postId, body: body.trim() } });
      setBody("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (commentId: string) => {
    try {
      await del({ data: { commentId } });
      setComments((cs) => cs.filter((c) => c.id !== commentId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">💬 Comments</h2>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>

      {userId ? (
        <form onSubmit={onSubmit} className="mb-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            placeholder="say something kind. or honest. or both."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:border-primary/60 outline-none text-sm resize-none"
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{body.length}/1000 · be kind, stay anon</span>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {submitting ? "posting…" : "post"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          <Link to="/enter" search={{ redirect: undefined }} className="text-primary underline">
            Sign in
          </Link>{" "}
          to drop a comment.
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet — be the first.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold truncate">
                    {c.author?.nickname ?? c.author?.handle ?? "anon"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  {userId === c.userId && (
                    <button
                      onClick={() => onDelete(c.id)}
                      className="ml-auto text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      delete
                    </button>
                  )}
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

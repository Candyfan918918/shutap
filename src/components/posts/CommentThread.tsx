import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useGateStore } from "@/stores/gate";
import {
  addComment,
  listComments,
  deleteComment,
  toggleCommentReaction,
  toggleChangedMind,
  toggleSameSituation,
  markCounselPick,
  COMMENT_SORTS,
  type CommentRow,
  type CommentSort,
  type CommentReactionKind,
} from "@/lib/posts/community.functions";
import { supabase } from "@/integrations/supabase/client";

const PROMPTS: Array<{ label: string; text: string }> = [
  { label: "😭 funny", text: "Girl 😭 absolutely not." },
  { label: "💛 supportive", text: "Honestly this healed me. Sending love." },
  { label: "🫣 real", text: "Respectfully this is suspicious." },
  { label: "👀 update?", text: "Need part 2 immediately." },
];

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

export interface CommentThreadHandle {
  focus: (preset?: string) => void;
}

interface Props {
  postId: string;
  postAuthorId?: string | null;
  onCommentPosted?: () => void;
}

export const CommentThread = forwardRef<CommentThreadHandle, Props>(function CommentThread(
  { postId, postAuthorId, onCommentPosted },
  ref,
) {
  const fetchComments = useServerFn(listComments);
  const post = useServerFn(addComment);
  const del = useServerFn(deleteComment);
  const reactFn = useServerFn(toggleCommentReaction);
  const changedMindFn = useServerFn(toggleChangedMind);
  const sameSitFn = useServerFn(toggleSameSituation);
  const counselPickFn = useServerFn(markCounselPick);
  const enqueue = useGateStore((s) => s.enqueue);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sort, setSort] = useState<CommentSort>("top");
  const [sameSitOpen, setSameSitOpen] = useState(false);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: (preset?: string) => {
      if (preset) setBody((b) => (b ? b : preset));
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => inputRef.current?.focus(), 350);
    },
  }));

  const refresh = async (s: CommentSort = sort) => {
    try {
      const list = await fetchComments({ data: { postId, limit: 100, sort: s } });
      setComments(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(sort); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [postId, sort]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  const isAuthor = !!userId && !!postAuthorId && userId === postAuthorId;
  const sameSitList = useMemo(() => comments.filter((c) => c.isSameSituation), [comments]);
  const mainList = useMemo(() => comments.filter((c) => !c.isSameSituation), [comments]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!userId) { enqueue({ type: "comment", entityId: postId }); return; }
    setSubmitting(true);
    try {
      await post({ data: { postId, body: body.trim() } });
      setBody("");
      await refresh();
      onCommentPosted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post comment");
    } finally { setSubmitting(false); }
  };

  const onDelete = async (commentId: string) => {
    try {
      await del({ data: { commentId } });
      setComments((cs) => cs.filter((c) => c.id !== commentId));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  };

  const onReact = async (c: CommentRow, kind: CommentReactionKind) => {
    if (!userId) { enqueue({ type: "comment", entityId: postId }); return; }
    try {
      if (kind === "changed_mind") await changedMindFn({ data: { commentId: c.id } });
      else await reactFn({ data: { commentId: c.id, kind } });
      void refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Reaction failed"); }
  };

  const onSameSit = async (c: CommentRow) => {
    if (!userId) { enqueue({ type: "comment", entityId: postId }); return; }
    if (c.userId !== userId) { toast.message("Only the comment author can tag this."); return; }
    try {
      await sameSitFn({ data: { commentId: c.id } });
      void refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't tag"); }
    setActionFor(null);
  };

  const onCounselPick = async (c: CommentRow) => {
    if (!isAuthor) return;
    try {
      await counselPickFn({ data: { postId, commentId: c.id } });
      toast.success("Marked as most helpful ✦");
      void refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't mark"); }
    setActionFor(null);
  };

  const renderItem = (c: CommentRow) => {
    const likedByMe = c.myReactions.includes("like");
    const laughedByMe = c.myReactions.includes("funny");
    const mindChangedByMe = c.myReactions.includes("changed_mind");
    return (
      <li
        key={c.id}
        className={`flex gap-3 p-3 rounded-xl transition ${
          c.isCounselPick ? "border border-amber-400/60 bg-amber-400/5" : ""
        }`}
        onContextMenu={(e) => { e.preventDefault(); setActionFor(c.id); }}
      >
        <div className="h-7 w-7 rounded-full bg-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-medium truncate">
              {c.author?.nickname ?? c.author?.handle ?? "anon"}
            </span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
            {c.isCounselPick && (
              <span className="text-[10px] font-medium text-amber-500">Most helpful ✦</span>
            )}
            {userId === c.userId && (
              <button onClick={() => onDelete(c.id)} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive">
                delete
              </button>
            )}
          </div>
          <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <button onClick={() => onReact(c, "like")} className={`flex items-center gap-1 ${likedByMe ? "text-rose-500 font-medium" : "hover:text-foreground"}`}>
              <span>{likedByMe ? "❤️" : "🤍"}</span><span>{c.likeCount}</span>
            </button>
            <button onClick={() => onReact(c, "funny")} className={`flex items-center gap-1 ${laughedByMe ? "text-amber-500 font-medium" : "hover:text-foreground"}`}>
              <span>😂</span><span>{c.funnyCount}</span>
            </button>
            <button onClick={() => onReact(c, "changed_mind")} className={`flex items-center gap-1 ${mindChangedByMe ? "text-primary font-medium" : "hover:text-foreground"}`}>
              <span>💡</span><span>changed my mind {c.changedMindsCount ? `· ${c.changedMindsCount}` : ""}</span>
            </button>
            <button onClick={() => setActionFor(c.id)} className="ml-auto hover:text-foreground">⋯</button>
          </div>

          {actionFor === c.id && (
            <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-border bg-surface-elevated p-2">
              {userId === c.userId && (
                <button onClick={() => onSameSit(c)} className="text-[11px] px-2 py-1 rounded-full bg-background border border-border hover:border-primary/50">
                  {c.isSameSituation ? "remove same-situation tag" : "🫂 same situation"}
                </button>
              )}
              {isAuthor && userId !== c.userId && !c.isCounselPick && (
                <button onClick={() => onCounselPick(c)} className="text-[11px] px-2 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-500 hover:bg-amber-400/25">
                  ✦ mark as most helpful
                </button>
              )}
              <button onClick={() => setActionFor(null)} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">close</button>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section ref={wrapRef} className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium">💬 Comments</h2>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>

      <div className="mb-4 flex gap-1 p-1 rounded-full bg-surface-elevated border border-border w-fit">
        {COMMENT_SORTS.map((s) => (
          <button key={s} onClick={() => setSort(s)} className={`px-3 py-1 text-[11px] rounded-full transition font-medium ${
            sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
            {s === "top" ? "🔥 top" : s === "newest" ? "🆕 newest" : "😂 funniest"}
          </button>
        ))}
      </div>

      {userId ? (
        <form onSubmit={onSubmit} className="mb-4 space-y-2">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            placeholder="What would you do?"
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border focus:border-primary/60 outline-none text-sm resize-none"
            maxLength={1000}
          />
          <div className="flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => (
              <button key={p.label} type="button" onClick={() => { setBody(p.text); inputRef.current?.focus(); }} className="px-2.5 py-1 rounded-full text-[10px] bg-surface-elevated border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition">
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{body.length}/1000 · be kind, stay anon</span>
            <button type="submit" disabled={submitting || !body.trim()} className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
              {submitting ? "posting…" : "post"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          <button type="button" onClick={() => enqueue({ type: "comment", entityId: postId })} className="text-primary underline">
            Sign in
          </button>{" "}to drop a comment.
        </div>
      )}

      {sameSitList.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-surface-elevated/40 overflow-hidden">
          <button onClick={() => setSameSitOpen((o) => !o)} className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium hover:bg-surface-elevated">
            <span>🫂 From people who've been there · {sameSitList.length}</span>
            <span className="text-muted-foreground">{sameSitOpen ? "−" : "+"}</span>
          </button>
          {sameSitOpen && (
            <ul className="p-2 space-y-2 border-t border-border">
              {sameSitList.map(renderItem)}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">The floor is opening.</p>
      ) : mainList.length === 0 && sameSitList.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No one has spoken yet. The floor is open.</p>
      ) : (
        <ul className="space-y-1">{mainList.map(renderItem)}</ul>
      )}
    </section>
  );
});

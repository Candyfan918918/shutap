import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  getArcStatus,
  listPostUpdates,
  toggleUpdateRequest,
  toggleArcFollow,
  postUpdate,
  UPDATE_KINDS,
  type PostUpdate,
  type UpdateKind,
  type ArcStatus,
} from "@/lib/posts/arcs.functions";

const KIND_LABEL: Record<UpdateKind, { emoji: string; label: string }> = {
  part:         { emoji: "📺", label: "Part" },
  time_jump:    { emoji: "⏭️", label: "Time jump" },
  got_better:   { emoji: "🌱", label: "Things got better" },
  got_worse:    { emoji: "🔥", label: "Things got worse" },
  broke_up:     { emoji: "💔", label: "We broke up" },
  got_married:  { emoji: "💍", label: "We got married" },
  final:        { emoji: "🏁", label: "Final chapter" },
};

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

interface Props { postId: string }

export function StoryArc({ postId }: Props) {
  const fetchStatus  = useServerFn(getArcStatus);
  const fetchUpdates = useServerFn(listPostUpdates);
  const reqToggle    = useServerFn(toggleUpdateRequest);
  const followToggle = useServerFn(toggleArcFollow);

  const [status,  setStatus]  = useState<ArcStatus | null>(null);
  const [updates, setUpdates] = useState<PostUpdate[]>([]);
  const [authed,  setAuthed]  = useState(false);
  const [composing, setComposing] = useState(false);

  const refresh = async () => {
    const [s, u] = await Promise.all([
      fetchStatus({ data: { postId } }),
      fetchUpdates({ data: { postId } }),
    ]);
    setStatus(s); setUpdates(u.updates);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthed(!!data.user);
      await refresh();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const onRequest = async () => {
    if (!authed) { toast.message("Sign in to request an update"); return; }
    if (!status) return;
    const prev = status.iRequested;
    setStatus({
      ...status,
      iRequested: !prev,
      requestCount: Math.max(0, status.requestCount + (prev ? -1 : 1)),
    });
    try {
      await reqToggle({ data: { postId } });
    } catch (e) {
      setStatus(status);
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    }
  };

  const onFollow = async () => {
    if (!authed) { toast.message("Sign in to follow this story"); return; }
    if (!status) return;
    const prev = status.iFollow;
    setStatus({ ...status, iFollow: !prev });
    try {
      const r = await followToggle({ data: { postId } });
      toast.success(r.following ? "Following 👀 you'll know when Part 2 drops" : "Unfollowed");
    } catch (e) {
      setStatus(status);
      toast.error(e instanceof Error ? e.message : "Couldn't follow");
    }
  };

  if (!status) return null;

  return (
    <section className="space-y-4">
      {/* Author CTA */}
      {status.isAuthor && status.requestCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 to-accent/15 p-4 flex items-center gap-3"
        >
          <span className="text-2xl">😭</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{fmt(status.requestCount)} people requested an update</p>
            <p className="text-xs text-muted-foreground">Tell us what happened next.</p>
          </div>
          <button
            onClick={() => setComposing(true)}
            className="shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold"
          >
            Post update
          </button>
        </motion.div>
      )}

      {/* Author entry point even with 0 requests */}
      {status.isAuthor && status.requestCount === 0 && (
        <button
          onClick={() => setComposing(true)}
          className="w-full px-4 py-3 rounded-2xl border border-dashed border-border text-sm font-semibold hover:border-primary/60 transition"
        >
          ✍️ Post an update (Part {(status.updateCount ?? 0) + 2})
        </button>
      )}

      {/* Viewer actions */}
      {!status.isAuthor && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRequest}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
              status.iRequested
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface-elevated border-border hover:border-primary/60"
            }`}
          >
            👀 {status.iRequested ? "Update requested" : "Need update"}
            {status.requestCount > 0 && (
              <span className="ml-2 opacity-80">· {fmt(status.requestCount)}</span>
            )}
          </button>
          <button
            onClick={onFollow}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
              status.iFollow
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-surface-elevated border-border hover:border-accent/60"
            }`}
          >
            {status.iFollow ? "🔔 Following arc" : "🔔 Follow arc"}
          </button>
        </div>
      )}

      {/* Timeline */}
      {updates.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">📖 Story arc · {updates.length + 1} {updates.length === 0 ? "chapter" : "chapters"}</p>
          <ol className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
            <TimelineDot />
            <li className="relative">
              <span className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">📍 Original story</p>
            </li>
            {updates.map((u) => (
              <li key={u.id} className="relative">
                <span className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {KIND_LABEL[u.kind].emoji} Part {u.episodeNumber} · {KIND_LABEL[u.kind].label}
                  <span className="ml-2 opacity-60">{new Date(u.createdAt).toLocaleDateString()}</span>
                </p>
                {u.title && <p className="text-sm font-semibold mt-0.5">{u.title}</p>}
                <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap">{u.body}</p>
                {u.mediaUrl && (
                  <img src={u.mediaUrl} alt="" className="mt-2 rounded-xl max-h-72 object-cover w-full" loading="lazy" />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <AnimatePresence>
        {composing && (
          <UpdateComposer
            postId={postId}
            nextEpisode={(status.updateCount ?? 0) + 2}
            onClose={() => setComposing(false)}
            onPosted={async () => { setComposing(false); await refresh(); }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function TimelineDot() { return null; }

function UpdateComposer({
  postId, nextEpisode, onClose, onPosted,
}: { postId: string; nextEpisode: number; onClose: () => void; onPosted: () => void }) {
  const submit = useServerFn(postUpdate);
  const [kind, setKind] = useState<UpdateKind>("part");
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");
  const [busy,  setBusy]  = useState(false);

  const send = async () => {
    if (body.trim().length < 2) { toast.error("Tell us what happened"); return; }
    setBusy(true);
    try {
      await submit({ data: { postId, kind, title: title.trim() || null, body: body.trim() } });
      toast.success(`Part ${nextEpisode} is live 👀`);
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post");
    } finally { setBusy(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="mx-auto max-w-lg px-5 py-8 min-h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">✍️ Post Part {nextEpisode}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Followers and everyone who asked for an update will be notified.
        </p>

        <label className="mt-5 text-xs font-semibold text-muted-foreground">What happened?</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {UPDATE_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-2 rounded-xl border text-xs text-left transition ${
                kind === k
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-elevated hover:border-primary/40"
              }`}
            >
              {KIND_LABEL[k].emoji} {KIND_LABEL[k].label}
            </button>
          ))}
        </div>

        <label className="mt-5 text-xs font-semibold text-muted-foreground">Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder={`Part ${nextEpisode}…`}
          className="mt-2 w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary"
        />

        <label className="mt-4 text-xs font-semibold text-muted-foreground">The update</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={8}
          placeholder="Spill the tea… what happened next?"
          className="mt-2 w-full px-3 py-3 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary"
        />
        <p className="mt-1 text-[10px] text-muted-foreground text-right">{body.length}/4000</p>

        <button
          onClick={send}
          disabled={busy}
          className="mt-6 w-full py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm disabled:opacity-60"
        >
          {busy ? "Posting…" : `📣 Drop Part ${nextEpisode}`}
        </button>
      </div>
    </motion.div>
  );
}

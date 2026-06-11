// Composer overlay for author-only actions: post update, sequel, close case.
// Mounted on /me/posts/$postId when `?action=update|sequel|close` is present.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { postUpdate, UPDATE_KINDS, type UpdateKind } from "@/lib/posts/arcs.functions";
import { createSequel, closeCase } from "@/lib/posts/sequel.functions";

type Action = "update" | "sequel" | "close";

interface Props {
  postId: string;
  action: Action;
  onClose: () => void;
}

const COPY: Record<Action, { title: string; bench: string; cta: string }> = {
  update: {
    title: "Post an update",
    bench: "The room is waiting. Don't keep them guessing.",
    cta: "Drop the update",
  },
  sequel: {
    title: "Post a sequel",
    bench: "New chapter. Every past voter gets pinged to reconsider.",
    cta: "Publish sequel",
  },
  close: {
    title: "Close the case",
    bench: "Tell the room what actually happened. The bench will note it.",
    cta: "Close case",
  },
};

export function AuthorActionComposer({ postId, action, onClose }: Props) {
  const navigate = useNavigate();
  const copy = COPY[action];

  // shared
  const [submitting, setSubmitting] = useState(false);
  // update
  const [kind, setKind] = useState<UpdateKind>("part");
  const [updateTitle, setUpdateTitle] = useState("");
  const [body, setBody] = useState("");
  // sequel
  const [sequelTitle, setSequelTitle] = useState("");
  const [sequelText, setSequelText] = useState("");
  // close
  const [whatHappened, setWhatHappened] = useState("");
  const [howYouFeel, setHowYouFeel] = useState("");
  const [whatChanged, setWhatChanged] = useState("");
  const [benchLine, setBenchLine] = useState("");

  const runUpdate = useServerFn(postUpdate);
  const runSequel = useServerFn(createSequel);
  const runClose = useServerFn(closeCase);

  async function submit() {
    setSubmitting(true);
    try {
      if (action === "update") {
        if (body.trim().length < 2) throw new Error("Write a little more.");
        await runUpdate({
          data: { postId, kind, title: updateTitle.trim() || null, body: body.trim() },
        });
        toast.success("Update posted. Followers notified.");
        onClose();
      } else if (action === "sequel") {
        const r = await runSequel({
          data: {
            originalPostId: postId,
            title: sequelTitle.trim(),
            storyText: sequelText.trim(),
            visibility: "public",
          },
        });
        toast.success("Sequel live. The room is being notified.");
        navigate({ to: "/post/$postId", params: { postId: r.id } });
      } else {
        const r = await runClose({
          data: {
            originalPostId: postId,
            whatHappened: whatHappened.trim(),
            howYouFeel: howYouFeel.trim(),
            whatChanged: whatChanged.trim(),
            benchClosingLine: benchLine.trim() || undefined,
          },
        });
        toast.success("Case closed. The bench has noted it.");
        navigate({ to: "/post/$postId", params: { postId: r.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-medium">{copy.title}</h2>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            close
          </button>
        </div>
        <p className="text-[12px] italic" style={{ color: "var(--c-text-3)" }}>
          The Bench: {copy.bench}
        </p>

        {action === "update" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {UPDATE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    kind === k
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-elevated border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {k.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <input
              value={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.value.slice(0, 140))}
              placeholder="Title (optional)"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              placeholder="What happened next?"
              rows={6}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground">{body.length}/4000</p>
          </>
        )}

        {action === "sequel" && (
          <>
            <input
              value={sequelTitle}
              onChange={(e) => setSequelTitle(e.target.value.slice(0, 120))}
              placeholder="Sequel title"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
            />
            <textarea
              value={sequelText}
              onChange={(e) => setSequelText(e.target.value.slice(0, 4000))}
              placeholder="The next chapter. New facts, new stakes."
              rows={8}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Past voters will be pinged: “New information. Does your verdict change?”
            </p>
          </>
        )}

        {action === "close" && (
          <>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">What actually happened</span>
              <textarea
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value.slice(0, 2000))}
                rows={4}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">How you feel about it now</span>
              <textarea
                value={howYouFeel}
                onChange={(e) => setHowYouFeel(e.target.value.slice(0, 500))}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">What changed your mind</span>
              <textarea
                value={whatChanged}
                onChange={(e) => setWhatChanged(e.target.value.slice(0, 500))}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Closing line for the bench (optional)</span>
              <input
                value={benchLine}
                onChange={(e) => setBenchLine(e.target.value.slice(0, 280))}
                placeholder="The bar has been set."
                className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
              />
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
          >
            cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            {submitting ? "posting…" : copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

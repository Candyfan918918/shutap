// Retract bottom sheet — irreversible. Calls /moderation action='retract'.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { moderate } from "@/lib/moderation.functions";
import { BENCH } from "@/lib/bench-copy";

interface Props {
  postId: string;
  onClose: () => void;
}

export function RetractStorySheet({ postId, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const runModerate = useServerFn(moderate);

  async function retract() {
    setBusy(true);
    try {
      const res = await runModerate({
        data: { story_id: postId, action: "retract", reason: "author retraction" },
      });
      if (res?.error) throw new Error(res.error);
      toast(BENCH.confirm.storyRetracted);
      navigate({ to: "/me/posts" });
    } catch (e) {
      toast(e instanceof Error ? e.message : BENCH.error.actionNotRecorded);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-border bg-card p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium text-foreground">Retract this case</h2>
        <p className="text-sm text-muted-foreground">
          Your story will be removed immediately. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-full text-xs border border-border bg-surface-elevated text-foreground"
          >
            Keep it
          </button>
          <button
            onClick={retract}
            disabled={busy}
            className="px-4 py-2 rounded-full text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--c-coral, hsl(var(--destructive)))" }}
          >
            {busy ? "Retracting…" : "Retract"}
          </button>
        </div>
      </div>
    </div>
  );
}

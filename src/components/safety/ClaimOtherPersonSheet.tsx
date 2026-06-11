// "I am the other person" claim flow.
// Step 1: three standing-verification questions (AI-generated upstream;
//         passed in as props so this component stays presentational).
// Step 2: choose path — Share my side (Spill) | Flag as inaccurate (moderation).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { moderate } from "@/lib/moderation.functions";
import { toast } from "sonner";
import { BENCH } from "@/lib/bench-copy";

type Props = {
  postId: string;
  questions: string[];                    // exactly 3 from agent
  onClose: () => void;
};

export function ClaimOtherPersonSheet({ postId, questions, onClose }: Props) {
  const [phase, setPhase] = useState<"answer" | "choose">("answer");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const moderateFn = useServerFn(moderate);

  const ready = answers.every((a) => a.trim().length >= 3);

  async function flagAsInaccurate() {
    setBusy(true);
    try {
      const res = await moderateFn({
        data: {
          story_id: postId,
          action: "dispute",
          reason: `claim:other-person — answers: ${answers.map((a) => a.trim()).join(" | ")}`,
        },
      });
      if (res.error) throw new Error(res.error);
      toast(BENCH.confirm.outcomeLogged);
      onClose();
    } catch {
      toast(BENCH.error.actionNotRecorded);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[250] bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        {phase === "answer" ? (
          <>
            <header>
              <h2 className="text-foreground text-base font-medium">You say this is about you.</h2>
              <p className="text-muted-foreground text-sm mt-1">Three questions. Only you would know.</p>
            </header>
            <div className="space-y-3">
              {questions.slice(0, 3).map((q, i) => (
                <label key={i} className="block">
                  <span className="text-sm text-foreground">{q}</span>
                  <textarea
                    rows={2}
                    value={answers[i] ?? ""}
                    onChange={(e) => {
                      const next = [...answers]; next[i] = e.target.value; setAnswers(next);
                    }}
                    className="mt-1 w-full rounded-md bg-background border border-border p-2 text-sm text-foreground"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground">Cancel</button>
              <button
                disabled={!ready}
                onClick={() => setPhase("choose")}
                className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <header>
              <h2 className="text-foreground text-base font-medium">What do you want to do?</h2>
              <p className="text-muted-foreground text-sm mt-1">Your call. The Bench will listen.</p>
            </header>
            <div className="flex flex-col gap-2">
              <button
                disabled={busy}
                onClick={() => { onClose(); navigate({ to: "/spill/start" as never }); }}
                className="px-4 py-3 text-sm rounded-md border border-border bg-card hover:bg-accent text-foreground text-left"
              >
                Share my side
              </button>
              <button
                disabled={busy}
                onClick={flagAsInaccurate}
                className="px-4 py-3 text-sm rounded-md border border-border text-foreground text-left hover:bg-accent"
                style={{ borderColor: "var(--c-coral, hsl(var(--destructive)))" }}
              >
                Flag as inaccurate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

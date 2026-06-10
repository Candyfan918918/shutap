// OutcomePrompt — plaintiff-only inline card to submit how the story actually ended.
// Renders only when the post belongs to the current user and no outcome exists.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { submitOutcome, getOutcome, OUTCOME_LABELS } from "@/lib/outcomes.functions";

const TYPES = Object.keys(OUTCOME_LABELS) as Array<keyof typeof OUTCOME_LABELS>;

export function OutcomePrompt({
  postId,
  authorId,
}: {
  postId: string;
  authorId: string;
}) {
  const fetchOutcome = useServerFn(getOutcome);
  const submit = useServerFn(submitOutcome);

  const [me, setMe] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ outcome_type: string; detail: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof OUTCOME_LABELS | null>(null);
  const [detail, setDetail] = useState("");
  const [days, setDays] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    supabase.auth.getUser().then(({ data }) => !dead && setMe(data.user?.id ?? null));
    fetchOutcome({ data: { post_id: postId } }).then((r) => !dead && setOutcome(r.data as any));
    return () => { dead = true; };
  }, [postId, fetchOutcome]);

  const isAuthor = me && me === authorId;
  if (!isAuthor) return null;
  if (outcome) {
    return (
      <section
        className="rounded-2xl border p-4 sm:p-5"
        style={{ borderColor: "var(--c-teal)", background: "#e8f7f3" }}
      >
        <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
          You filed the outcome
        </div>
        <div className="text-[14px] font-medium mt-0.5" style={{ color: "var(--c-text-1)" }}>
          {OUTCOME_LABELS[outcome.outcome_type as keyof typeof OUTCOME_LABELS] ?? outcome.outcome_type}
        </div>
        {outcome.detail && (
          <p className="text-[12px] mt-1" style={{ color: "var(--c-text-2)" }}>
            {outcome.detail}
          </p>
        )}
      </section>
    );
  }

  async function onSubmit() {
    if (!type || busy) return;
    setBusy(true);
    try {
      const r = await submit({
        data: {
          post_id: postId,
          outcome_type: type,
          detail: detail.trim() || undefined,
          days_elapsed: days ? Math.max(0, Number(days) || 0) : undefined,
        },
      });
      if (r.error || !r.data) throw new Error(r.error ?? "Outcome not recorded.");
      setOutcome({ outcome_type: type, detail: detail.trim() || null });
      if (typeof window !== "undefined") window.dispatchEvent(new Event("wg:refresh"));
      toast(
        r.data.totalPredictions > 0
          ? `${r.data.correctCount}/${r.data.totalPredictions} predictions called it.`
          : "Outcome filed. The Bench takes note.",
      );
    } catch (e: any) {
      toast(e?.message ?? "Outcome not recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border p-4 sm:p-5 space-y-3"
      style={{ borderColor: "var(--c-amber)", background: "#fffaee" }}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
            Plaintiff only
          </div>
          <div className="text-[14px] font-medium" style={{ color: "var(--c-text-1)" }}>
            How did this actually end?
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{ background: "var(--c-amber)", color: "#fff" }}
          >
            File outcome →
          </button>
        )}
      </header>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {TYPES.map((t) => {
                const on = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="rounded-xl border px-3 py-2 text-left text-[12px] font-medium transition"
                    style={
                      on
                        ? { borderColor: "var(--c-amber)", background: "#fff", color: "#7a4a00" }
                        : { borderColor: "var(--c-border)", background: "var(--c-surface)", color: "var(--c-text-1)" }
                    }
                  >
                    {OUTCOME_LABELS[t]}
                  </button>
                );
              })}
            </div>

            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 500))}
              placeholder="Optional — one line on what actually happened."
              rows={2}
              className="w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--c-border)", color: "var(--c-text-1)" }}
            />

            <div className="flex items-center gap-2">
              <label className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
                Days since
              </label>
              <input
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="—"
                className="w-16 rounded-lg border bg-white px-2 py-1 text-[12px] tabular-nums outline-none"
                style={{ borderColor: "var(--c-border)" }}
              />
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-3 py-1.5 text-[12px]"
                  style={{ color: "var(--c-text-3)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!type || busy}
                  onClick={onSubmit}
                  className="rounded-full px-4 py-1.5 text-[12px] font-medium disabled:opacity-50"
                  style={{ background: "var(--c-amber)", color: "#fff" }}
                >
                  {busy ? "Filing…" : "File"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

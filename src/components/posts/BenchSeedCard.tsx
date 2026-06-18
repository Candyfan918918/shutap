// The Bench's first read — and the one-shot Objection affordance.
// Renders below the verdict bar. Author-only "Object" button; everyone sees the seed comment.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getBenchSeed, runObjection } from "@/lib/bench/bench.functions";

type Props = {
  postId: string;
  viewerIsAuthor: boolean;
};

const TAG_LABEL: Record<string, string> = {
  red_flag: "Red flag",
  run: "Run",
  therapy: "Therapy",
  need_update: "Need more info",
  lawyer_up: "Lawyer up",
  talk_it_out: "Talk it out",
  green_flag: "Green flag",
};

export function BenchSeedCard({ postId, viewerIsAuthor }: Props) {
  const fetchSeed = useServerFn(getBenchSeed);
  const fetchObject = useServerFn(runObjection);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["bench-seed", postId],
    queryFn: () => fetchSeed({ data: { postId } }),
    staleTime: 30_000,
  });

  if (!data || !data.bench_seed_comment) return null;

  const objection = data.bench_objection_response as
    | { ruling: string; comment: string; updated_lean: string; objection_text: string }
    | null;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full"
          style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}
        >
          The Bench, first read
        </span>
        {data.bench_seed_verdict_tag ? (
          <span className="text-xs" style={{ color: "var(--c-text-2)" }}>
            {TAG_LABEL[data.bench_seed_verdict_tag] ?? data.bench_seed_verdict_tag}
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-snug">{data.bench_seed_comment}</p>

      {viewerIsAuthor && !data.bench_objection_used && !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{ borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
        >
          Object — one reply only
        </button>
      ) : null}

      {viewerIsAuthor && !data.bench_objection_used && showForm ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Make your case. You get one shot."
            className="w-full text-sm p-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--c-border)" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
              {text.length}/200
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setText("");
                }}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ color: "var(--c-text-2)" }}
              >
                Cancel
              </button>
              <button
                disabled={submitting || text.trim().length < 4}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await fetchObject({ data: { postId, objectionText: text.trim() } });
                    await refetch();
                    setShowForm(false);
                    setText("");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Objection failed");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Filing…" : "File objection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {objection ? (
        <div
          className="rounded-xl p-3 space-y-2 border"
          style={{ borderColor: "var(--c-border)", background: "var(--c-surface-3)" }}
        >
          <p className="text-xs" style={{ color: "var(--c-text-3)" }}>
            You objected: <span style={{ color: "var(--c-text-2)" }}>"{objection.objection_text}"</span>
          </p>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}
            >
              Ruling: {objection.ruling.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm leading-snug">{objection.comment}</p>
          <p className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
            The matter is now with the jury.
          </p>
        </div>
      ) : null}

      {data.bench_overturned_comment ? (
        <div
          className="rounded-xl p-3 space-y-1 border"
          style={{ borderColor: "var(--c-border)", background: "var(--c-surface-3)" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider font-medium"
            style={{ color: "var(--c-text-2)" }}
          >
            Bench {data.bench_overturned_outcome === "overturned" ? "overturned" : "upheld"}
          </span>
          <p className="text-sm leading-snug">{data.bench_overturned_comment}</p>
        </div>
      ) : null}
    </div>
  );
}

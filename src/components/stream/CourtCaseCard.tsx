// CourtCaseCard — stream variant. Renders an active court case as a tappable
// card with the live court ribbon countdown.
import { useNavigate } from "@tanstack/react-router";
import type { CourtCasePayload } from "@/lib/stream.functions";
import { CourtRibbon } from "./CourtRibbon";

interface Props {
  payload: CourtCasePayload;
  index: number;
}

export function CourtCaseCard({ payload, index }: Props) {
  const navigate = useNavigate();
  const isPortrait = index % 2 === 0;
  const aspect = isPortrait ? "3/4" : "4/3";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => void navigate({ to: "/post/$postId", params: { postId: payload.post_id } })}
      className="relative flex flex-col overflow-hidden cursor-pointer transition active:scale-[0.995] p-3"
      style={{
        background: "linear-gradient(165deg, var(--c-amber-soft, #fef0d0) 0%, var(--c-surface-2, #faf6f1) 100%)",
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px solid var(--c-border, #e3ddd2)",
        aspectRatio: aspect,
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="px-2 h-5 inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.05em] rounded-full"
          style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}
        >
          In Court
        </span>
      </div>

      <h3
        className="mt-3 text-[14px] font-medium leading-snug line-clamp-3 flex-1"
        style={{ color: "var(--c-text-1)" }}
      >
        {payload.title ?? "Case opened — verdict pending."}
      </h3>

      <div className="mt-2">
        <CourtRibbon
          category={payload.category}
          tier={payload.tier}
          lockAt={payload.lock_at}
        />
      </div>

      <p className="mt-1 text-[10px]" style={{ color: "var(--c-text-3)" }}>
        {payload.region_label ?? "Open hearing"} · tap to weigh in
      </p>
    </article>
  );
}

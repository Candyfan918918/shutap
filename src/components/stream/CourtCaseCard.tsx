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
  const coverAspect = index % 2 === 0 ? "4/5" : "1/1";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => void navigate({ to: "/post/$postId", params: { postId: payload.post_id } })}
      className="relative flex flex-col overflow-hidden cursor-pointer transition active:scale-[0.99] hover:shadow-md"
      style={{
        background: "var(--c-surface, #fff)",
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px solid var(--c-border, #e3ddd2)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: coverAspect,
          background: "linear-gradient(155deg, #fff4d1 0%, #fbcf6b 55%, #b07a18 100%)",
        }}
      >
        <span
          className="absolute top-2.5 left-2.5 px-2 h-6 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.05em] rounded-full"
          style={{ background: "rgba(255,255,255,0.85)", color: "var(--c-amber, #b07a18)" }}
        >
          ⚖️ In Court
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[72px] drop-shadow-sm select-none" aria-hidden>⚖️</span>
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <CourtRibbon
            category={payload.category}
            tier={payload.tier}
            lockAt={payload.lock_at}
          />
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-2.5">
        <h3
          className="text-[14px] font-semibold leading-snug line-clamp-3"
          style={{ color: "var(--c-text-1)" }}
        >
          {payload.title ?? "Case opened — verdict pending."}
        </h3>
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--c-text-3)" }}>
          {payload.region_label ?? "Open hearing"} · tap to weigh in
        </p>
      </div>
    </article>
  );
}

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
  const ratios = ["4/5", "1/1", "3/4", "4/5"];
  const coverAspect = ratios[index % ratios.length];

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
          className="absolute top-1.5 left-1.5 inline-flex items-center font-semibold uppercase tracking-[0.05em] rounded-full"
          style={{
            background: "rgba(255,255,255,0.85)",
            color: "var(--c-amber, #b07a18)",
            fontSize: "clamp(9px, 1.5vw, 10.5px)",
            padding: "2px 7px",
            lineHeight: 1.4,
          }}
        >
          ⚖️ In Court
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="drop-shadow-sm select-none"
            style={{ fontSize: "clamp(48px, 13vw, 88px)" }}
            aria-hidden
          >
            ⚖️
          </span>
        </div>
        <div className="absolute bottom-1.5 left-1.5 right-1.5">
          <CourtRibbon
            category={payload.category}
            tier={payload.tier}
            lockAt={payload.lock_at}
          />
        </div>
      </div>

      <div style={{ padding: "8px 10px" }}>
        <h3
          className="font-semibold line-clamp-3"
          style={{
            color: "var(--c-text-1)",
            fontSize: "clamp(12.5px, 1.9vw, 14.5px)",
            lineHeight: 1.3,
          }}
        >
          {payload.title ?? "Case opened — verdict pending."}
        </h3>
        <p
          className="mt-1"
          style={{
            color: "var(--c-text-3)",
            fontSize: "clamp(10px, 1.5vw, 11.5px)",
            lineHeight: 1.35,
          }}
        >
          {payload.region_label ?? "Open hearing"} · tap to weigh in
        </p>
      </div>
    </article>
  );
}

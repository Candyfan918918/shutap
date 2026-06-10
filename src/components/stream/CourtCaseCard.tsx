// CourtCaseCard — uses shared stream-card tokens for layout/typography.
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { CourtCasePayload } from "@/lib/stream.functions";
import { CourtRibbon } from "./CourtRibbon";
import { generateStoryCoverSVG } from "@/lib/stream/generate-cover";

interface Props {
  payload: CourtCasePayload;
  index: number;
}

export function CourtCaseCard({ payload, index }: Props) {
  const navigate = useNavigate();
  const ratios = ["4/5", "1/1", "3/4", "4/5"];
  const coverAspect = ratios[index % ratios.length];

  const coverUrl = useMemo(
    () => generateStoryCoverSVG({ seed: payload.case_id, category: payload.category, emoji: "⚖️" }),
    [payload.case_id, payload.category],
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => void navigate({ to: "/post/$postId", params: { postId: payload.post_id } })}
      className="stream-card"
    >
      <div
        className="stream-card__cover"
        style={{ aspectRatio: coverAspect, backgroundImage: `url("${coverUrl}")` }}
      >
        <span
          className="stream-card__chip"
          style={{
            top: 6,
            left: 6,
            background: "rgba(255,255,255,0.88)",
            color: "var(--c-amber)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          ⚖️ In Court
        </span>
        <div className="absolute" style={{ bottom: 6, left: 6, right: 6 }}>
          <CourtRibbon
            category={payload.category}
            tier={payload.tier}
            lockAt={payload.lock_at}
          />
        </div>
      </div>

      <div className="stream-card__body">
        <h3 className="stream-card__title stream-card__title--court">
          {payload.title ?? "Case opened — verdict pending."}
        </h3>
        <p className="stream-card__meta">
          {payload.region_label ?? "Open hearing"} · tap to weigh in
        </p>
      </div>
    </article>
  );
}

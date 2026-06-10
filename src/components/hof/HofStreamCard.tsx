// Spec-compliant HOF stream card.
// Replaces the legacy gradient tile. 4:3 ratio, amber border, surface-2 bg.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { categoryByKey, periodLabel, type HofPeriod } from "@/lib/hof-categories";
import { NominateActionSheet } from "@/components/hof/NominateActionSheet";

export interface HofStreamPayload {
  entity_type: "story" | "case" | "user";
  entity_id: string;
  period: string;
  category: string;
  rank: number;
  score: number;
  title: string | null;
  alias_label?: string | null;
  alias_emoji?: string | null;
  verdict_pct?: number | null;
  juror_count?: number | null;
  juror_title?: string | null;
  bench_line?: string | null;
  post_id?: string | null;
}

export function HofStreamCard({ payload }: { payload: HofStreamPayload }) {
  const cat = categoryByKey(payload.category);
  const [nomOpen, setNomOpen] = useState(false);

  const to: any =
    payload.entity_type === "story" && payload.post_id
      ? { to: "/post/$postId", params: { postId: payload.post_id } }
      : payload.entity_type === "case" && payload.post_id
      ? { to: "/post/$postId", params: { postId: payload.post_id } }
      : payload.entity_type === "user"
      ? { to: "/u/$handle", params: { handle: payload.alias_label ?? "unknown" } }
      : { to: "/hof" };

  return (
    <>
      <article
        className="relative flex flex-col p-4"
        style={{
          background: "var(--c-surface-2)",
          borderRadius: "var(--r-md, 14px)",
          border: "0.5px solid var(--c-amber, #d4a341)",
          aspectRatio: "4/3",
        }}
      >
        <Link {...to} className="absolute inset-0 z-0" aria-label="Open" />
        <div className="relative z-10 flex items-center justify-between">
          <span
            className="px-2 h-5 inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.05em] rounded-full"
            style={{ background: "rgba(212,163,65,0.18)", color: "var(--c-amber-ink, #7a5a14)" }}
          >
            {cat?.emoji ?? "🏛️"} Hall of Fame
          </span>
          <span
            className="text-[9.5px] uppercase tracking-[0.08em]"
            style={{ color: "var(--c-text-3)" }}
          >
            {periodLabel((payload.period as HofPeriod) ?? "weekly")}
          </span>
        </div>

        <div className="relative z-10 mt-2 flex items-baseline gap-2">
          <h3
            className="text-[18px] font-semibold leading-tight"
            style={{ color: "var(--c-text-1)" }}
          >
            {cat?.label ?? payload.category}
          </h3>
        </div>

        <div className="relative z-10 mt-1 flex items-center gap-2">
          <span
            className="text-[26px] font-bold leading-none tabular-nums"
            style={{ color: "var(--c-amber, #b8851f)" }}
          >
            #{payload.rank}
          </span>
          <span className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
            score {Math.round(payload.score)}
          </span>
        </div>

        <div className="relative z-10 mt-2 flex-1 min-h-0">
          {payload.entity_type === "user" ? (
            <div className="flex flex-col gap-1">
              <span
                className="self-start px-2 py-0.5 rounded-full text-[12px]"
                style={{ background: "var(--c-surface-3)", color: "var(--c-text-1)" }}
              >
                {payload.alias_emoji ?? "👤"} {payload.alias_label ?? "anonymous"}
              </span>
              {payload.juror_title && (
                <span className="text-[11px]" style={{ color: "var(--c-text-2)" }}>
                  {payload.juror_title}
                </span>
              )}
            </div>
          ) : (
            <p
              className="text-[13px] leading-snug line-clamp-3"
              style={{ color: "var(--c-text-1)" }}
            >
              {payload.title ?? "A case the room won't let go of."}
            </p>
          )}

          {payload.entity_type === "case" && payload.verdict_pct != null && (
            <p className="mt-1 text-[11px] tabular-nums" style={{ color: "var(--c-text-2)" }}>
              {payload.verdict_pct}% · {payload.juror_count ?? 0} jurors
            </p>
          )}
        </div>

        {payload.bench_line && (
          <p
            className="relative z-10 mt-1 text-[11px] italic leading-tight"
            style={{ color: "var(--c-text-2)" }}
          >
            "{payload.bench_line}"
          </p>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setNomOpen(true); }}
          className="relative z-10 self-end mt-1 text-[10.5px] px-2 py-1 rounded-full"
          style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}
        >
          + Nominate
        </button>
      </article>

      <NominateActionSheet
        open={nomOpen}
        onClose={() => setNomOpen(false)}
        entityType={payload.entity_type}
        entityId={payload.entity_id}
      />
    </>
  );
}

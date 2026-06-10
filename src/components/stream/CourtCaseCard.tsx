// CourtCaseCard (stream) — 4:3 cover, case_title + question_before_court,
// live mini verdict bar (Realtime), prediction bar after lock, watch-live CTA
// in the final 60 minutes. Tapping the card → /post/$postId; tapping "Watch
// live" opens the WatchPartyOverlay portal.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { CourtCasePayload } from "@/lib/stream.functions";
import { CourtRibbon } from "./CourtRibbon";
import { generateStoryCoverSVG } from "@/lib/stream/generate-cover";
import { supabase } from "@/integrations/supabase/client";
import { WatchPartyOverlay } from "./WatchPartyOverlay";
import { PredictionBar } from "@/components/posts/PredictionBar";


interface Props {
  payload: CourtCasePayload;
  index: number;
}

const VERDICT_META: Record<string, { emoji: string; color: string; short: string }> = {
  red_flag: { emoji: "🚩", color: "#dc2626", short: "Red" },
  green_flag: { emoji: "💚", color: "#16a34a", short: "Green" },
  run: { emoji: "🏃", color: "#f97316", short: "Run" },
  talk_it_out: { emoji: "🗣", color: "#0ea5e9", short: "Talk" },
  lawyer_up: { emoji: "⚖️", color: "#7c3aed", short: "Lawyer" },
  therapy_might_help: { emoji: "🛋", color: "#db2777", short: "Therapy" },
  need_update: { emoji: "👀", color: "#64748b", short: "Update" },
};

const ORDER = [
  "red_flag",
  "green_flag",
  "run",
  "talk_it_out",
  "lawyer_up",
  "therapy_might_help",
  "need_update",
];

export function CourtCaseCard({ payload }: Props) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>(payload.verdicts ?? {});
  const [total, setTotal] = useState<number>(payload.verdict_total ?? 0);
  const [watchOpen, setWatchOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const coverUrl = useMemo(
    () => generateStoryCoverSVG({ seed: payload.case_id, category: payload.category, emoji: "⚖️" }),
    [payload.case_id, payload.category],
  );

  // Live counts
  useEffect(() => {
    const ch = supabase
      .channel(`court-card:${payload.case_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_verdict_votes", filter: `post_id=eq.${payload.post_id}` },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const k = payload.new?.kind as string | undefined;
            if (!k) return;
            setCounts((p) => ({ ...p, [k]: (p[k] ?? 0) + 1 }));
            setTotal((t) => t + 1);
          } else if (payload.eventType === "DELETE") {
            const k = payload.old?.kind as string | undefined;
            if (!k) return;
            setCounts((p) => ({ ...p, [k]: Math.max(0, (p[k] ?? 0) - 1) }));
            setTotal((t) => Math.max(0, t - 1));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [payload.case_id, payload.post_id]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const lockMs = payload.lock_at ? new Date(payload.lock_at).getTime() - now : null;
  const inFinal60 = lockMs != null && lockMs > 0 && lockMs <= 60 * 60_000;
  const isLocked = payload.status !== "in_court" || (lockMs != null && lockMs <= 0);

  const titleText = payload.case_title || payload.title || "Case opened — verdict pending.";
  const question = payload.question_before_court;

  const sorted = ORDER
    .map((k) => ({ k, n: counts[k] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const dominant = sorted[0] ?? null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => void navigate({ to: "/post/$postId", params: { postId: payload.post_id } })}
        className="stream-card"
        style={{ borderColor: "var(--c-amber, #f5b840)" }}
      >
        {/* Cover — always 4:3 for court cases */}
        <div
          className="stream-card__cover"
          style={{ aspectRatio: "4/3", backgroundImage: `url("${coverUrl}")` }}
        >
          <div className="absolute" style={{ top: 6, left: 6, right: 6 }}>
            <CourtRibbon category={payload.category} tier={payload.tier} lockAt={payload.lock_at} />
          </div>
          {inFinal60 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setWatchOpen(true); }}
              className="absolute inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold animate-[ribbonPulse_900ms_ease-in-out_infinite]"
              style={{ bottom: 6, right: 6, background: "var(--c-coral, #ff7a6b)", color: "#1a1a1a" }}
            >
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-700 animate-ping" />
              Watch live
            </button>
          )}
        </div>

        {/* Body */}
        <div className="stream-card__body">
          <h3 className="stream-card__title stream-card__title--court" style={{ fontWeight: 700 }}>
            {titleText}
          </h3>
          {question && (
            <p className="text-[12px] italic" style={{ color: "var(--c-text-2)" }}>
              {question}
            </p>
          )}

          {/* Mini verdict bar */}
          <div className="space-y-1 pt-1">
            <div className="flex h-2 gap-px overflow-hidden rounded-full" style={{ background: "var(--c-surface-2, #2a2a2a)" }}>
              {ORDER.map((k) => {
                const pct = total > 0 ? ((counts[k] ?? 0) / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <span key={k} className="transition-[flex-basis] duration-500" style={{ flexBasis: `${pct}%`, background: VERDICT_META[k].color }} />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--c-text-3)" }}>
              <span>
                {dominant
                  ? <>{VERDICT_META[dominant.k].emoji} {VERDICT_META[dominant.k].short} · {Math.round((dominant.n / Math.max(total, 1)) * 100)}%</>
                  : "Jury still gathering"}
              </span>
              <span className="tabular-nums">{total.toLocaleString()} votes</span>
            </div>
          </div>

          {/* Compact verdict chips (top 3) */}
          {!isLocked && (
            <div className="flex flex-wrap gap-1 pt-1">
              {ORDER.slice(0, 3).map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-[10px]"
                  style={{ background: "var(--c-surface-2, #2a2a2a)", color: "var(--c-text-2)" }}
                >
                  <span aria-hidden>{VERDICT_META[k].emoji}</span>
                  <span className="tabular-nums">{counts[k] ?? 0}</span>
                </span>
              ))}
              <span className="text-[10px] self-center" style={{ color: "var(--c-text-3)" }}>+ tap to vote</span>
            </div>
          )}

          {/* Locked → bench line */}
          {isLocked && payload.bench_verdict_line && (
            <p className="text-[11px] pt-1 italic" style={{ color: "var(--c-text-2)" }}>
              {payload.bench_verdict_line}
            </p>
          )}

          <p className="stream-card__meta">
            {payload.region_label ?? "Open hearing"} · {isLocked ? "verdict in" : "tap to weigh in"}
          </p>
        </div>
      </article>

      {watchOpen && (
        <WatchPartyOverlay
          caseId={payload.case_id}
          postId={payload.post_id}
          title={titleText}
          regionLabel={payload.region_label}
          lockAt={payload.lock_at}
          benchVerdictLine={payload.bench_verdict_line}
          onClose={() => setWatchOpen(false)}
        />
      )}
    </>
  );
}

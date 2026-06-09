// Watch Party — surfaces when a case is < 60min from verdict lock.
// Realtime verdict bar (subscribes to post_verdict_votes inserts) + countdown.
// No AI commentary yet — that layer arrives with the bench_commentary agent.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CourtCase } from "@/lib/court.functions";
import { CountdownChip } from "./CountdownChip";

type VerdictKey =
  | "red_flag"
  | "green_flag"
  | "run"
  | "talk_it_out"
  | "lawyer_up"
  | "therapy_might_help"
  | "need_update";

const COLORS: Record<VerdictKey, string> = {
  red_flag: "var(--c-red-flag, #dc2626)",
  green_flag: "var(--c-green-flag, #16a34a)",
  run: "var(--c-run, #f97316)",
  talk_it_out: "var(--c-talk, #0ea5e9)",
  lawyer_up: "var(--c-lawyer, #7c3aed)",
  therapy_might_help: "var(--c-therapy, #db2777)",
  need_update: "var(--c-update, #64748b)",
};

const LABELS: Record<VerdictKey, string> = {
  red_flag: "Red flag",
  green_flag: "Green flag",
  run: "Run",
  talk_it_out: "Talk it out",
  lawyer_up: "Lawyer up",
  therapy_might_help: "Therapy",
  need_update: "Need update",
};

export function shouldShowWatchParty(c: CourtCase): boolean {
  if (c.status !== "in_court") return false;
  const lockAt = c.verdictLockAt ?? c.closesAt;
  if (!lockAt) return false;
  const ms = new Date(lockAt).getTime() - Date.now();
  return ms > 0 && ms <= 60 * 60_000;
}

export function WatchParty({ c }: { c: CourtCase }) {
  const initialCounts = useMemo<Record<VerdictKey, number>>(() => {
    const base: Record<VerdictKey, number> = {
      red_flag: 0,
      green_flag: 0,
      run: 0,
      talk_it_out: 0,
      lawyer_up: 0,
      therapy_might_help: 0,
      need_update: 0,
    };
    for (const k of Object.keys(base) as VerdictKey[]) {
      base[k] = (c.verdict.counts as Record<string, number>)[k] ?? 0;
    }
    return base;
  }, [c.verdict.counts]);

  const [counts, setCounts] = useState(initialCounts);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    setCounts(initialCounts);
  }, [initialCounts]);

  useEffect(() => {
    if (!c.post?.id) return;
    const channel = supabase
      .channel(`watch-party-${c.post.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_verdict_votes",
          filter: `post_id=eq.${c.post.id}`,
        },
        (payload) => {
          const kind = (payload.new as { kind?: VerdictKey })?.kind;
          if (!kind || !(kind in counts)) return;
          setCounts((prev) => ({ ...prev, [kind]: (prev[kind] ?? 0) + 1 }));
          setPulse((p) => p + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [c.post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sorted = (Object.entries(counts) as Array<[VerdictKey, number]>)
    .sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0];

  return (
    <section
      className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3"
      style={{ borderColor: "var(--c-amber, #d97706)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            key={pulse}
            className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-ping"
            aria-hidden
          />
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Watch Party · final hour
          </span>
        </div>
        <CountdownChip
          to={c.verdictLockAt ?? c.closesAt}
          prefix="Locks in"
          closedLabel="Locked"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex h-3 gap-px overflow-hidden rounded-md bg-surface-elevated">
          {(Object.keys(COLORS) as VerdictKey[]).map((k) => {
            const pct = total > 0 ? (counts[k] / total) * 100 : 0;
            return (
              <span
                key={k}
                className="transition-[flex-basis] duration-500"
                style={{ flexBasis: `${pct}%`, background: COLORS[k] }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {dominant && dominant[1] > 0
              ? `Leading: ${LABELS[dominant[0]]} · ${Math.round((dominant[1] / Math.max(total, 1)) * 100)}%`
              : "Jury still settling in."}
          </span>
          <span>{total.toLocaleString()} live</span>
        </div>
      </div>
    </section>
  );
}

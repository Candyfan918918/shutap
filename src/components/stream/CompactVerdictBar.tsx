// CompactVerdictBar — 6px feed variant, 7 segments, animated fills.
// Subscribes to Supabase realtime when `live` is true (story detail uses the
// full VerdictBar elsewhere). User's vote draws a 1px white outline.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const VERDICT_KINDS = [
  "red_flag",
  "green_flag",
  "run",
  "talk_it_out",
  "lawyer_up",
  "therapy_might_help",
  "need_update",
] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];

const COLORS: Record<VerdictKind, string> = {
  red_flag: "var(--c-red-flag, #f09595)",
  green_flag: "var(--c-green-flag, #94c47d)",
  run: "var(--c-coral, #ff7a6b)",
  talk_it_out: "var(--c-pink-deep, #d97aa1)",
  lawyer_up: "var(--c-amber, #f5b840)",
  therapy_might_help: "var(--c-purple, #9b7ad9)",
  need_update: "var(--c-text-3, #888)",
};

interface Props {
  postId: string;
  initialCounts?: Partial<Record<VerdictKind, number>>;
  myVerdict?: VerdictKind | null;
  height?: number;
  live?: boolean;
}

export function CompactVerdictBar({
  postId,
  initialCounts,
  myVerdict,
  height = 6,
  live = true,
}: Props) {
  const [counts, setCounts] = useState<Record<VerdictKind, number>>(() => {
    const seed: Record<VerdictKind, number> = {} as any;
    for (const k of VERDICT_KINDS) seed[k] = initialCounts?.[k] ?? 0;
    return seed;
  });

  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel(`vbar:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_verdict_votes", filter: `post_id=eq.${postId}` },
        (payload: any) => {
          setCounts((prev) => {
            const next = { ...prev };
            if (payload.eventType === "INSERT") {
              const k = payload.new?.kind as VerdictKind | undefined;
              if (k) next[k] = (next[k] ?? 0) + 1;
            } else if (payload.eventType === "DELETE") {
              const k = payload.old?.kind as VerdictKind | undefined;
              if (k) next[k] = Math.max(0, (next[k] ?? 0) - 1);
            } else if (payload.eventType === "UPDATE") {
              const oldK = payload.old?.kind as VerdictKind | undefined;
              const newK = payload.new?.kind as VerdictKind | undefined;
              if (oldK) next[oldK] = Math.max(0, (next[oldK] ?? 0) - 1);
              if (newK) next[newK] = (next[newK] ?? 0) + 1;
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, live]);

  const total = VERDICT_KINDS.reduce((acc, k) => acc + (counts[k] ?? 0), 0);

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height, borderRadius: "var(--r-pill, 9999px)", background: "var(--c-surface-3, #eee)" }}
      role="img"
      aria-label={`${total} verdicts`}
    >
      {VERDICT_KINDS.map((k) => {
        const pct = total > 0 ? ((counts[k] ?? 0) / total) * 100 : 0;
        if (pct === 0) return null;
        const isMine = myVerdict === k;
        return (
          <div
            key={k}
            style={{
              width: `${pct}%`,
              background: COLORS[k],
              transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: isMine ? "inset 0 0 0 1px #fff" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

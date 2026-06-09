import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  castVerdict,
  removeVerdict,
  getVerdictCounts,
  getMyVerdict,
  VERDICT_KINDS,
  type VerdictKind,
  type VerdictCounts,
} from "@/lib/posts/community.functions";
import { supabase } from "@/integrations/supabase/client";

const LABELS: Record<VerdictKind, { emoji: string; label: string }> = {
  red_flag: { emoji: "🚩", label: "Red flag" },
  green_flag: { emoji: "💚", label: "Green flag" },
  run: { emoji: "🏃", label: "Run" },
  talk_it_out: { emoji: "🗣️", label: "Talk it out" },
  lawyer_up: { emoji: "⚖️", label: "Lawyer up" },
  therapy_might_help: { emoji: "🛋️", label: "Therapy" },
  need_update: { emoji: "👀", label: "Need update!" },
};

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

interface Props {
  postId: string;
  onVoted?: (kind: VerdictKind) => void;
}

export function VerdictBar({ postId, onVoted }: Props) {
  const getCounts = useServerFn(getVerdictCounts);
  const getMine = useServerFn(getMyVerdict);
  const cast = useServerFn(castVerdict);
  const remove = useServerFn(removeVerdict);

  const empty = (): VerdictCounts =>
    VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);
  const [counts, setCounts] = useState<VerdictCounts>(empty);
  const [mine, setMine] = useState<VerdictKind | null>(null);
  const [authed, setAuthed] = useState(false);
  const [total, setTotal] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getCounts({ data: { postId } });
      if (!cancelled) { setCounts(r.counts); setTotal(r.total); }
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthed(!!u.user);
      if (u.user) {
        try {
          const m = await getMine({ data: { postId } });
          if (!cancelled) setMine(m.kind);
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [postId, getCounts, getMine]);

  const onVote = async (kind: VerdictKind) => {
    if (!authed) { toast.message("Sign in to vote"); return; }
    const prev = mine;
    setCounts((c) => {
      const next = { ...c };
      if (prev && prev !== kind) next[prev] = Math.max(0, next[prev] - 1);
      if (prev === kind) {
        next[kind] = Math.max(0, next[kind] - 1);
      } else {
        next[kind] = next[kind] + 1;
      }
      return next;
    });
    setTotal((t) => {
      if (prev === kind) return Math.max(0, t - 1);
      if (prev) return t;
      return t + 1;
    });
    const nextMine = prev === kind ? null : kind;
    setMine(nextMine);
    try {
      if (prev === kind) await remove({ data: { postId } });
      else await cast({ data: { postId, kind } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
      return;
    }
    if (nextMine) {
      setShowNudge(true);
      onVoted?.(kind);
    } else {
      setShowNudge(false);
    }
  };

  // Compute max for bar fill
  const maxCount = Math.max(1, ...VERDICT_KINDS.map((k) => counts[k]));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium">⚖️ Your verdict?</p>
        <span className="text-xs text-muted-foreground">{fmt(total)} {total === 1 ? "vote" : "votes"}</span>
      </div>
      <div className="space-y-1.5">
        {VERDICT_KINDS.map((k) => {
          const active = mine === k;
          const pct = (counts[k] / maxCount) * 100;
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVote(k)}
              className={`relative w-full overflow-hidden rounded-full border text-left px-3 py-2 transition ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-elevated hover:border-primary/50"
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 ${
                  active ? "bg-primary/25" : "bg-primary/10"
                }`}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between text-xs">
                <span className="font-medium">
                  {LABELS[k].emoji} {LABELS[k].label}
                </span>
                <span className={`tabular-nums ${active ? "font-medium" : "text-muted-foreground"}`}>
                  {fmt(counts[k])}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {showNudge && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary p-3"
          >
            <p className="text-xs font-medium">Wait… what would YOU do? 👀</p>
            <button
              onClick={() => onVoted?.(mine!)}
              className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium"
            >
              💬 Drop a comment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion } from "framer-motion";
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

export function VerdictBar({ postId }: { postId: string }) {
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
    // Optimistic
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
    setMine(prev === kind ? null : kind);
    try {
      if (prev === kind) await remove({ data: { postId } });
      else await cast({ data: { postId, kind } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold">⚖️ Your verdict?</p>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? "vote" : "votes"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {VERDICT_KINDS.map((k) => {
          const active = mine === k;
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.95 }}
              onClick={() => onVote(k)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-elevated border-border hover:border-primary/50"
              }`}
            >
              {LABELS[k].emoji} {LABELS[k].label} · {counts[k]}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

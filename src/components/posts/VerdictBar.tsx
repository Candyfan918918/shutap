// VerdictBar — story-detail full version. 7 verdicts in a 3+3+1 grid,
// selected state = filled bg + 1px white outline, Realtime counts via
// Supabase channel, soft-gate for anonymous users, read-depth weighted vote.
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
import { useSoftGate } from "@/components/stream/useSoftGate";

type RelationshipType = "marriage" | "dating" | "breakup" | "situationship" | "family" | "other";

const BASE_LABELS: Record<VerdictKind, { emoji: string; label: string }> = {
  red_flag: { emoji: "🚩", label: "Red flag" },
  green_flag: { emoji: "💚", label: "Green flag" },
  run: { emoji: "🏃", label: "Run" },
  talk_it_out: { emoji: "🗣️", label: "Talk it out" },
  lawyer_up: { emoji: "⚖️", label: "Lawyer up" },
  therapy_might_help: { emoji: "🛋️", label: "Therapy" },
  need_update: { emoji: "👀", label: "Need update" },
};

// Per-relationship label overrides; missing entries fall back to BASE_LABELS.
const RELATIONSHIP_LABELS: Partial<Record<RelationshipType, Partial<Record<VerdictKind, string>>>> = {
  marriage: { run: "File", talk_it_out: "Couples counseling", lawyer_up: "Divorce attorney" },
  dating: { run: "Break it off", lawyer_up: "Block & move on" },
  breakup: { run: "No contact", talk_it_out: "Closure talk", need_update: "Need closure" },
  situationship: { run: "Walk away", talk_it_out: "Define it" },
  family: { run: "Low contact", lawyer_up: "Mediation", therapy_might_help: "Family therapy" },
};

function labelFor(kind: VerdictKind, rel?: RelationshipType | null) {
  const base = BASE_LABELS[kind];
  const override = rel ? RELATIONSHIP_LABELS[rel]?.[kind] : undefined;
  return { emoji: base.emoji, label: override ?? base.label };
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

interface Props {
  postId: string;
  relationshipType?: RelationshipType | null;
  readDepthPercent?: number;
  devilsAdvocate?: boolean;
  onVoted?: (kind: VerdictKind) => void;
}

// 3 + 3 + 1 layout
const ROW_1: VerdictKind[] = ["red_flag", "green_flag", "run"];
const ROW_2: VerdictKind[] = ["talk_it_out", "lawyer_up", "therapy_might_help"];
const ROW_3: VerdictKind[] = ["need_update"];

export function VerdictBar({
  postId,
  relationshipType,
  readDepthPercent = 0,
  devilsAdvocate = false,
  onVoted,
}: Props) {
  const getCounts = useServerFn(getVerdictCounts);
  const getMine = useServerFn(getMyVerdict);
  const cast = useServerFn(castVerdict);
  const remove = useServerFn(removeVerdict);
  const softGate = useSoftGate();

  const empty = (): VerdictCounts =>
    VERDICT_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as VerdictCounts);
  const [counts, setCounts] = useState<VerdictCounts>(empty);
  const [mine, setMine] = useState<VerdictKind | null>(null);
  const [authed, setAuthed] = useState(false);
  const [total, setTotal] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  // Initial load + auth check
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

  // Realtime subscription — keep counts fresh without polling.
  useEffect(() => {
    const channel = supabase
      .channel(`vbar-full:${postId}`)
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
          setTotal((t) => {
            if (payload.eventType === "INSERT") return t + 1;
            if (payload.eventType === "DELETE") return Math.max(0, t - 1);
            return t;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  const onVote = async (kind: VerdictKind) => {
    if (!authed) { softGate("vote", { entityId: postId, verdictKind: kind }); return; }
    const prev = mine;
    // Optimistic update
    setCounts((c) => {
      const next = { ...c };
      if (prev && prev !== kind) next[prev] = Math.max(0, next[prev] - 1);
      if (prev === kind) next[kind] = Math.max(0, next[kind] - 1);
      else next[kind] = next[kind] + 1;
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
      else await cast({ data: { postId, kind, read_depth_percent: readDepthPercent } as any });
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

  const renderBtn = (k: VerdictKind) => {
    const active = mine === k;
    const { emoji, label } = labelFor(k, relationshipType);
    return (
      <motion.button
        key={k}
        whileTap={{ scale: 0.97 }}
        onClick={() => onVote(k)}
        className={`relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border text-center transition ${
          active
            ? "bg-primary text-primary-foreground border-primary outline outline-1 outline-white/80"
            : "bg-surface-elevated border-border hover:border-primary/50"
        }`}
      >
        <span className="text-lg leading-none" aria-hidden>{emoji}</span>
        <span className="text-[11px] font-medium leading-tight">{label}</span>
        <span className={`text-[10px] tabular-nums ${active ? "opacity-90" : "text-muted-foreground"}`}>
          {fmt(counts[k])}
        </span>
      </motion.button>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium">
          ⚖️ {devilsAdvocate ? "Voting as the other person" : "Your verdict?"}
        </p>
        <span className="text-xs text-muted-foreground">
          {fmt(total)} {total === 1 ? "vote" : "votes"}
        </span>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">{ROW_1.map(renderBtn)}</div>
        <div className="grid grid-cols-3 gap-2">{ROW_2.map(renderBtn)}</div>
        <div className="grid grid-cols-1 gap-2">{ROW_3.map(renderBtn)}</div>
      </div>

      <AnimatePresence>
        {showNudge && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3"
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

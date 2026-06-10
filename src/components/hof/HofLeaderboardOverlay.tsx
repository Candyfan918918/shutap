// HOF Leaderboard — full-screen overlay (not a route). Opened from the
// chatbot or alias profile. Realtime updates on hof_scores.
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HOF_CATEGORIES, HOF_PERIODS, periodLabel, type HofPeriod } from "@/lib/hof-categories";
import { listLeaderboard } from "@/lib/hof.functions";

type EntityTab = "case" | "story" | "user";

interface Props {
  open: boolean;
  onClose: () => void;
  initialCategory?: string;
  initialEntity?: EntityTab;
  initialPeriod?: HofPeriod;
}

export function HofLeaderboardOverlay({
  open,
  onClose,
  initialCategory = "most_dramatic",
  initialEntity = "case",
  initialPeriod = "weekly",
}: Props) {
  const [entity, setEntity] = useState<EntityTab>(initialEntity);
  const [category, setCategory] = useState<string>(initialCategory);
  const [period, setPeriod] = useState<HofPeriod>(initialPeriod);
  const fetchLb = useServerFn(listLeaderboard);
  const qc = useQueryClient();

  const eligibleCats = HOF_CATEGORIES.filter((c) => c.appliesTo.includes(entity));
  useEffect(() => {
    if (!eligibleCats.some((c) => c.key === category)) {
      setCategory(eligibleCats[0]?.key ?? "most_dramatic");
    }
  }, [entity]); // eslint-disable-line

  const q = useQuery({
    enabled: open,
    queryKey: ["hof_lb", entity, category, period],
    queryFn: () => fetchLb({ data: { entity_type: entity, category, period, limit: 20 } }),
    staleTime: 15_000,
  });

  // Realtime on hof_scores → refetch on any change to this slice
  useEffect(() => {
    if (!open) return;
    const ch = supabase
      .channel(`hof_lb_${entity}_${category}_${period}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hof_scores", filter: `category=eq.${category}` },
        () => qc.invalidateQueries({ queryKey: ["hof_lb", entity, category, period] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [open, entity, category, period, qc]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55]"
          style={{ background: "var(--c-surface)" }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="h-full overflow-y-auto"
          >
            <header
              className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--c-surface)", borderBottom: "0.5px solid var(--c-surface-3)" }}
            >
              <button onClick={onClose} className="text-[13px]" style={{ color: "var(--c-text-3)" }}>
                ← Close
              </button>
              <span className="text-[12px] font-medium" style={{ color: "var(--c-text-1)" }}>
                Hall of Fame
              </span>
              <span className="w-10" />
            </header>

            {/* Entity tabs */}
            <div className="px-4 pt-3 flex gap-2">
              {(["case", "story", "user"] as EntityTab[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEntity(e)}
                  className="px-3 h-7 rounded-full text-[11px] capitalize"
                  style={
                    entity === e
                      ? { background: "var(--c-text-1)", color: "var(--c-surface)" }
                      : { background: "var(--c-surface-2)", color: "var(--c-text-2)" }
                  }
                >
                  {e === "case" ? "Cases" : e === "story" ? "Stories" : "Users"}
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div className="px-4 pt-2.5 pb-1 flex gap-1.5 overflow-x-auto no-scrollbar">
              {eligibleCats.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className="whitespace-nowrap px-2.5 h-7 rounded-full text-[11px]"
                  style={
                    category === c.key
                      ? { background: "var(--c-amber, #d4a341)", color: "var(--c-surface)" }
                      : { background: "var(--c-surface-2)", color: "var(--c-text-2)" }
                  }
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            {/* Period toggle */}
            <div className="px-4 pt-2 pb-3 flex gap-1.5">
              {HOF_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-2.5 h-7 rounded-full text-[11px]"
                  style={
                    period === p
                      ? { background: "var(--c-text-1)", color: "var(--c-surface)" }
                      : { background: "var(--c-surface-2)", color: "var(--c-text-3)" }
                  }
                >
                  {periodLabel(p)}
                </button>
              ))}
            </div>

            {/* List */}
            <ul className="px-4 pb-32 space-y-2">
              {(q.data?.entries ?? []).map((e) => {
                const cat = HOF_CATEGORIES.find((c) => c.key === category);
                const to: any =
                  e.entity_type === "user"
                    ? { to: "/u/$handle", params: { handle: e.alias_label ?? "unknown" } }
                    : { to: "/post/$postId", params: { postId: e.entity_id } };
                return (
                  <li key={`${e.entity_type}-${e.entity_id}`}>
                    <Link
                      {...to}
                      onClick={onClose}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "var(--c-surface-2)" }}
                    >
                      <span
                        className="w-7 text-center font-semibold tabular-nums"
                        style={{ color: e.rank <= 3 ? "var(--c-amber, #b8851f)" : "var(--c-text-3)" }}
                      >
                        #{e.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: "var(--c-text-1)" }}>
                          {e.entity_type === "user"
                            ? `${e.alias_emoji ?? "👤"} ${e.alias_label ?? "anonymous"}`
                            : e.title ?? "Untitled"}
                        </p>
                        <p className="text-[10.5px] italic" style={{ color: "var(--c-text-3)" }}>
                          {cat?.benchLine ?? ""}
                        </p>
                      </div>
                      <span className="text-[11px] tabular-nums" style={{ color: "var(--c-text-2)" }}>
                        {Math.round(e.score)}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {q.data && q.data.entries.length === 0 && (
                <li className="text-center text-[12px] py-10" style={{ color: "var(--c-text-3)" }}>
                  No entries yet. The Bench is waiting.
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

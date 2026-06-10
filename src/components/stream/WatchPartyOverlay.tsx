// WatchPartyOverlay — full-screen portal opened from court card "Watch live" CTA.
// - Realtime VerdictBar (full width, live counts from post_verdict_votes)
// - Alias pop feed (left): new voter aliases appear ≤1/sec, fade after 3s
// - Comment rail (right): live new comments
// - Bench commentary cards: float up from bottom every 3-5 min, 8s duration
// - Countdown chip (center-top, large)
// - Lock sequence: tension hold → bar fills → bench line reveal → emoji float
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  caseId: string;
  postId: string;
  title: string;
  regionLabel: string | null;
  lockAt: string | null;
  benchVerdictLine: string | null;
  onClose: () => void;
}

const VERDICT_META: Record<string, { emoji: string; color: string; label: string }> = {
  red_flag: { emoji: "🚩", color: "#dc2626", label: "Red flag" },
  green_flag: { emoji: "💚", color: "#16a34a", label: "Green flag" },
  run: { emoji: "🏃", color: "#f97316", label: "Run" },
  talk_it_out: { emoji: "🗣", color: "#0ea5e9", label: "Talk it out" },
  lawyer_up: { emoji: "⚖️", color: "#7c3aed", label: "Lawyer up" },
  therapy_might_help: { emoji: "🛋", color: "#db2777", label: "Therapy" },
  need_update: { emoji: "👀", color: "#64748b", label: "Need update" },
};
const ORDER = Object.keys(VERDICT_META);

const BENCH_LINES = [
  "The room is louder than the case.",
  "Three new voters in the last minute.",
  "Verdict is hardening. The bench notices.",
  "A late witness arrives. Watch the bar.",
  "Quiet in the gallery. Read carefully.",
];

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type AliasPop = { id: string; alias: string; emoji: string; verdict: string };

export function WatchPartyOverlay({ caseId, postId, title, regionLabel, lockAt, benchVerdictLine, onClose }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [aliasPops, setAliasPops] = useState<AliasPop[]>([]);
  const [comments, setComments] = useState<Array<{ id: string; body: string }>>([]);
  const [benchCard, setBenchCard] = useState<string | null>(null);
  const [phase, setPhase] = useState<"live" | "hold" | "filling" | "revealed">("live");
  const [emojiBurst, setEmojiBurst] = useState<string | null>(null);
  const [revealedLine, setRevealedLine] = useState<string | null>(benchVerdictLine);
  const lastPopAt = useRef(0);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Initial counts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("post_verdict_votes")
        .select("kind")
        .eq("post_id", postId);
      if (cancelled) return;
      const tally: Record<string, number> = {};
      for (const r of (data ?? []) as Array<{ kind: string }>) {
        tally[r.kind] = (tally[r.kind] ?? 0) + 1;
      }
      setCounts(tally);
      setTotal((data ?? []).length);
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // Realtime votes + alias pops (max 1/sec)
  useEffect(() => {
    if (phase !== "live") return;
    const ch = supabase
      .channel(`watch-party:${caseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_verdict_votes", filter: `post_id=eq.${postId}` },
        async (p: any) => {
          const kind = p.new?.kind as string | undefined;
          if (!kind) return;
          setCounts((prev) => ({ ...prev, [kind]: (prev[kind] ?? 0) + 1 }));
          setTotal((t) => t + 1);
          const t = Date.now();
          if (t - lastPopAt.current < 1000) return;
          lastPopAt.current = t;
          const userId = p.new?.user_id as string | undefined;
          let alias = "a stranger";
          let emoji = "🧑‍⚖️";
          if (userId) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("nickname, emoji")
              .eq("id", userId)
              .maybeSingle();
            if (prof?.nickname) alias = prof.nickname as string;
            if (prof?.emoji) emoji = prof.emoji as string;
          }
          const id = `${t}-${Math.random()}`;
          setAliasPops((prev) => [...prev, { id, alias, emoji, verdict: kind }]);
          window.setTimeout(() => setAliasPops((prev) => prev.filter((a) => a.id !== id)), 3000);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (p: any) => {
          const body = (p.new?.body as string | undefined)?.slice(0, 140);
          if (!body) return;
          setComments((prev) => [{ id: p.new.id, body }, ...prev].slice(0, 8));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [caseId, postId, phase]);

  // 1s clock
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Bench commentary every 3-5 min, 8s duration
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      const delay = (3 + Math.random() * 2) * 60_000;
      window.setTimeout(() => {
        if (cancelled || phase !== "live") return;
        const line = BENCH_LINES[Math.floor(Math.random() * BENCH_LINES.length)];
        setBenchCard(line);
        window.setTimeout(() => setBenchCard(null), 8000);
        schedule();
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
  }, [phase]);

  // Lock sequence
  const lockMs = lockAt ? new Date(lockAt).getTime() - now : null;
  useEffect(() => {
    if (phase !== "live" || lockMs == null || lockMs > 0) return;
    setPhase("hold");
    window.setTimeout(() => setPhase("filling"), 2000);
    window.setTimeout(async () => {
      // refetch the bench line if not yet available
      if (!revealedLine) {
        const { data: row } = await supabase
          .from("court_cases")
          .select("bench_verdict_line, final_verdict")
          .eq("id", caseId)
          .maybeSingle();
        if (row?.bench_verdict_line) setRevealedLine(row.bench_verdict_line as string);
        if ((row as any)?.final_verdict) setEmojiBurst(VERDICT_META[(row as any).final_verdict as string]?.emoji ?? "⚖️");
      } else {
        // pick dominant
        const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (dom) setEmojiBurst(VERDICT_META[dom[0]]?.emoji ?? "⚖️");
      }
      setPhase("revealed");
    }, 5000);
  }, [lockMs, phase, caseId, counts, revealedLine]);

  const dominant = useMemo(() => {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? null;
  }, [counts]);

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "var(--c-surface, #0b0b0b)", color: "var(--c-text-1, #f5f5f5)" }}
    >
      {/* Top bar */}
      <header className="flex items-start justify-between px-4 sm:px-6 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--c-amber)" }}>
            Watch Party · {regionLabel ?? "Open hearing"}
          </p>
          <h2 className="text-base sm:text-lg font-semibold leading-tight mt-1 max-w-[60vw]">{title}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full w-9 h-9 grid place-items-center text-lg"
          style={{ background: "var(--c-surface-2, #1a1a1a)" }}
        >
          ✕
        </button>
      </header>

      {/* Countdown */}
      <div className="flex justify-center py-3">
        <div
          className="inline-flex flex-col items-center px-5 py-2 rounded-2xl tabular-nums"
          style={{
            background: phase === "hold" ? "var(--c-coral, #ff7a6b)" : "var(--c-surface-2, #1a1a1a)",
            color: phase === "hold" ? "#1a1a1a" : "inherit",
            transition: "background 600ms",
          }}
        >
          <span className="text-[10px] uppercase tracking-widest opacity-70">
            {phase === "live" ? "Locks in" : phase === "hold" ? "Holding" : phase === "filling" ? "Verdict landing" : "Locked"}
          </span>
          <span className="text-3xl sm:text-4xl font-bold">
            {lockMs != null ? fmtRemaining(Math.max(0, lockMs)) : "—"}
          </span>
        </div>
      </div>

      {/* Body: alias feed | verdict bar | comments */}
      <div className="flex-1 grid grid-cols-12 gap-3 px-3 sm:px-5 pb-4 overflow-hidden">
        {/* Alias pop feed */}
        <div className="col-span-3 sm:col-span-3 relative overflow-hidden">
          <AnimatePresence>
            {aliasPops.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] mb-1 truncate"
                style={{ background: "var(--c-surface-2, #1a1a1a)", maxWidth: "100%" }}
              >
                <span>{a.emoji}</span>
                <span className="truncate">{a.alias}</span>
                <span style={{ color: VERDICT_META[a.verdict]?.color ?? "#888" }}>
                  {VERDICT_META[a.verdict]?.emoji}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Verdict bar (center) */}
        <div className="col-span-6 sm:col-span-6 flex flex-col justify-center">
          <div className="rounded-2xl p-4" style={{ background: "var(--c-surface-2, #1a1a1a)" }}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--c-text-3)" }}>
              {total.toLocaleString()} live verdicts
            </p>
            <div
              className="flex h-5 gap-0.5 overflow-hidden rounded-md mb-3"
              style={{
                background: "var(--c-surface-3, #232323)",
                transition: phase === "filling" ? "all 3000ms cubic-bezier(.2,.8,.2,1)" : "all 400ms",
              }}
            >
              {ORDER.map((k) => {
                const pct = total > 0 ? ((counts[k] ?? 0) / total) * 100 : 0;
                return (
                  <span
                    key={k}
                    style={{
                      flexBasis: `${pct}%`,
                      background: VERDICT_META[k].color,
                      transition: phase === "filling" ? "flex-basis 3000ms cubic-bezier(.2,.8,.2,1)" : "flex-basis 400ms ease",
                    }}
                  />
                );
              })}
            </div>
            <div className="space-y-1">
              {ORDER.map((k) => {
                const n = counts[k] ?? 0;
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{VERDICT_META[k].emoji}</span>
                      <span>{VERDICT_META[k].label}</span>
                    </span>
                    <span className="tabular-nums" style={{ color: VERDICT_META[k].color }}>
                      {pct}% · {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Comment rail */}
        <div className="col-span-3 sm:col-span-3 overflow-hidden space-y-1.5">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.p
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] px-2 py-1.5 rounded-md"
                style={{ background: "var(--c-surface-2, #1a1a1a)", color: "var(--c-text-2)" }}
              >
                {c.body}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bench commentary float */}
      <AnimatePresence>
        {benchCard && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl max-w-md text-center text-[12px] italic"
            style={{ background: "var(--c-amber, #f5b840)", color: "#1a1a1a" }}
          >
            ⚖️ {benchCard}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock sequence overlays */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[110] flex flex-col items-center justify-center text-center p-6"
            style={{ background: "rgba(0,0,0,0.92)" }}
          >
            {dominant && (
              <p className="text-6xl mb-4">{VERDICT_META[dominant[0]]?.emoji}</p>
            )}
            <p className="text-2xl sm:text-3xl font-semibold max-w-xl mb-6 leading-tight">
              {revealedLine ?? "The bench has ruled."}
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-medium"
              style={{ background: "var(--c-amber, #f5b840)", color: "#1a1a1a" }}
            >
              I watched this verdict drop live.
            </button>

            {/* Emoji float */}
            {emojiBurst && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ y: "110vh", opacity: 0, x: `${Math.random() * 100}vw` }}
                    animate={{ y: "-20vh", opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 4 + Math.random() * 2, delay: Math.random() * 1.5, ease: "easeOut" }}
                    className="absolute text-2xl"
                  >
                    {emojiBurst}
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

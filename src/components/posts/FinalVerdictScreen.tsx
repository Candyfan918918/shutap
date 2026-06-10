// FinalVerdictScreen — full-screen modal shown to a story's author the first
// time they open the app after their case is decided. Renders dominant
// verdict, juror count, bench line, and a share card CTA. Dismissal is
// persisted to localStorage keyed by case id.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface Props {
  caseId: string;
  postId: string;
  tier: string | null;
  regionLabel: string | null;
  caseTitle: string;
  finalVerdict: string | null;
  benchVerdictLine: string | null;
  total: number;
  dominantPct: number;
  alias: string | null;
  onClose: () => void;
}

const VERDICT_META: Record<string, { emoji: string; label: string; color: string }> = {
  red_flag: { emoji: "🚩", label: "Red flag", color: "#dc2626" },
  green_flag: { emoji: "💚", label: "Green flag", color: "#16a34a" },
  run: { emoji: "🏃", label: "Run", color: "#f97316" },
  talk_it_out: { emoji: "🗣", label: "Talk it out", color: "#0ea5e9" },
  lawyer_up: { emoji: "⚖️", label: "Lawyer up", color: "#7c3aed" },
  therapy_might_help: { emoji: "🛋", label: "Therapy", color: "#db2777" },
  need_update: { emoji: "👀", label: "Need update", color: "#64748b" },
};

export function FinalVerdictScreen({
  caseId,
  postId,
  tier,
  regionLabel,
  caseTitle,
  finalVerdict,
  benchVerdictLine,
  total,
  dominantPct,
  alias,
  onClose,
}: Props) {
  const meta = finalVerdict ? VERDICT_META[finalVerdict] : null;
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) + " Court" : (regionLabel ?? "Court");
  const shareUrl = `/api/public/og/case/${caseId}`;
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    const where = regionLabel ?? "the room";
    const verdict = meta?.label ?? "verdict";
    const who = alias ?? "anon";
    return `${dominantPct}% of ${where} said: ${verdict} — ${who}`;
  }, [regionLabel, meta, dominantPct, alias]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: caseTitle, text: shareText, url: window.location.href });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch { /* user cancelled */ }
  };

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center text-center p-6"
      style={{ background: "var(--c-surface, #0b0b0b)", color: "var(--c-text-1, #f5f5f5)" }}
    >
      <span
        className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest mb-3"
        style={{ background: "var(--c-amber, #f5b840)", color: "#1a1a1a" }}
      >
        ⚖️ {tierLabel} · Verdict in
      </span>

      <h2 className="text-xl sm:text-2xl font-semibold max-w-md leading-tight mb-6">
        {caseTitle}
      </h2>

      {meta && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 14 }}
          className="mb-4"
        >
          <p className="text-7xl mb-2">{meta.emoji}</p>
          <p className="text-3xl font-bold" style={{ color: meta.color }}>
            {meta.label}
          </p>
          <p className="text-lg tabular-nums opacity-80">{dominantPct}%</p>
        </motion.div>
      )}

      <p className="text-[12px] mb-2" style={{ color: "var(--c-text-3)" }}>
        {total.toLocaleString()} jurors weighed in
      </p>

      {benchVerdictLine && (
        <p className="text-sm sm:text-base italic max-w-md mb-8 leading-snug" style={{ color: "var(--c-text-2)" }}>
          “{benchVerdictLine}”
        </p>
      )}

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <a
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 rounded-full text-sm font-medium"
          style={{ background: "var(--c-surface-2, #1a1a1a)", color: "var(--c-text-1)" }}
        >
          🖼 Preview share card
        </a>
        <button
          onClick={handleShare}
          className="px-4 py-2.5 rounded-full text-sm font-medium"
          style={{ background: "var(--c-amber, #f5b840)", color: "#1a1a1a" }}
        >
          {copied ? "Copied" : "📤 Share the verdict"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-full text-sm"
          style={{ color: "var(--c-text-2)" }}
        >
          See the full case
        </button>
      </div>
    </motion.div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

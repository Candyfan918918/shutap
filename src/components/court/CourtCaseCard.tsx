import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { CourtCase, CourtTier } from "@/lib/court.functions";
import { CountdownChip } from "./CountdownChip";

const STATUS_PILL: Record<CourtCase["status"], { label: string; cls: string }> = {
  nominated: { label: "Nominated", cls: "bg-surface-elevated border-border text-muted-foreground" },
  in_court: { label: "In court", cls: "bg-primary/15 border-primary/40 text-primary" },
  judgment_pending: { label: "Judgment pending", cls: "bg-amber-500/15 border-amber-500/40 text-amber-500" },
  decided: { label: "Sealed", cls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-500" },
  legendary: { label: "Legendary", cls: "bg-primary text-primary-foreground border-transparent" },
  paused: { label: "Paused", cls: "bg-muted text-muted-foreground border-border" },
  rejected: { label: "Declined", cls: "bg-destructive/15 border-destructive/40 text-destructive" },
};

const TIER_RIBBON: Record<CourtTier, { label: string; cls: string }> = {
  city:     { label: "City Court",     cls: "bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300" },
  regional: { label: "Regional Court", cls: "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-300" },
  national: { label: "National Court", cls: "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300" },
  world:    { label: "World Court",    cls: "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300" },
};

const VERDICT_EMOJI: Record<string, string> = {
  red_flag: "🚩",
  green_flag: "💚",
  run: "🏃",
  talk_it_out: "🗣",
  lawyer_up: "⚖️",
  therapy_might_help: "🛋",
  need_update: "👀",
};

function topVerdict(c: CourtCase): { kind: string; pct: number } | null {
  if (c.verdict.total === 0) return null;
  const sorted = Object.entries(c.verdict.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const [k, n] = sorted[0];
  return { kind: k, pct: Math.round((n / c.verdict.total) * 100) };
}

function CourtCaseCardImpl({
  c,
  size = "md",
  index = 0,
}: {
  c: CourtCase;
  size?: "lg" | "md" | "sm";
  index?: number;
}) {
  if (!c.post) return null;
  const status = STATUS_PILL[c.status];
  const tier = TIER_RIBBON[c.currentTier];
  const top = topVerdict(c);
  const isLarge = size === "lg";
  const category = c.post.scoreCategory;
  const bothSides = c.post.bothSidesHeard;
  const sealed = c.status === "decided" || c.status === "legendary";

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition group"
    >
      <Link to="/post/$postId" params={{ postId: c.post.id }} search={{ shared: 2 }}>
        {c.post.mediaUrl && (
          <div className={`${isLarge ? "aspect-[16/9]" : "aspect-[4/3]"} bg-surface-elevated overflow-hidden relative`}>
            <img
              src={c.post.mediaUrl}
              alt={c.post.title}
              className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
            />
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur ${tier.cls}`}>
              {tier.label}
            </span>
          </div>
        )}
        <div className={`${isLarge ? "p-5 space-y-3" : "p-4 space-y-2"}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {!c.post.mediaUrl && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${tier.cls}`}>
                {tier.label}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.cls}`}>
              {status.label}
            </span>
            {category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-elevated border border-border text-muted-foreground capitalize">
                {category.replace(/_/g, " ")}
              </span>
            )}
            {bothSides && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
                Both sides heard
              </span>
            )}
            {c.isFlipRound && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-600 dark:text-fuchsia-300">
                Flip Round
              </span>
            )}
            {c.status === "in_court" && (
              <CountdownChip to={c.verdictLockAt ?? c.closesAt} prefix={c.isFlipRound ? "Flip locks in" : "Locks in"} />
            )}
          </div>

          <h3 className={`${isLarge ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} font-medium text-balance leading-tight`}>
            {c.post.title}
          </h3>

          {isLarge && !sealed && (
            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
              {c.post.storyText}
            </p>
          )}

          {sealed ? (
            <div className="space-y-1">
              {c.benchVerdictLine && (
                <p className="text-sm font-medium text-foreground/90 leading-snug">
                  {c.benchVerdictLine}
                </p>
              )}
              {c.finalJudgment && (
                <p className="text-xs text-muted-foreground italic">{c.finalJudgment}</p>
              )}
              {!c.benchVerdictLine && c.aiSummary && (
                <p className="text-sm font-medium text-foreground/90">{c.aiSummary}</p>
              )}
            </div>
          ) : top ? (
            <div className="text-[11px] text-muted-foreground">
              Leading: <span className="font-medium text-foreground">{VERDICT_EMOJI[top.kind] ?? ""} {top.pct}%</span>
              <span className="mx-1">·</span>
              {c.verdict.total} verdict{c.verdict.total === 1 ? "" : "s"}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">No verdicts yet.</div>
          )}

          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>💬 {c.post.commentCount}</span>
            <span>❤️ {c.post.likeCount}</span>
            <span>📤 {c.post.shareCount}</span>
            {c.post.perspectiveCount > 0 && <span>👥 {c.post.perspectiveCount}</span>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export const CourtCaseCard = memo(CourtCaseCardImpl);

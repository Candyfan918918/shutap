import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { CourtCase } from "@/lib/court.functions";
import { CountdownChip } from "./CountdownChip";

const VERDICT_META: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  red_flag: { label: "Red flag", emoji: "🚩", color: "var(--c-red-flag)" },
  green_flag: { label: "Green flag", emoji: "💚", color: "var(--c-green-flag)" },
  run: { label: "Run", emoji: "🏃", color: "var(--c-run)" },
  talk_it_out: { label: "Talk it out", emoji: "🗣", color: "var(--c-talk)" },
  lawyer_up: { label: "Lawyer up", emoji: "⚖️", color: "var(--c-lawyer)" },
  therapy_might_help: { label: "Therapy", emoji: "🛋", color: "var(--c-therapy)" },
  need_update: { label: "Need update", emoji: "👀", color: "var(--c-update)" },
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

function leading(c: CourtCase): { kind: string; pct: number } | null {
  if (c.verdict.total === 0) return null;
  const sorted = Object.entries(c.verdict.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  const [k, n] = sorted[0];
  return { kind: k, pct: Math.round((n / c.verdict.total) * 100) };
}

export function CourtroomPanel({ c }: { c: CourtCase }) {
  if (!c.post) return null;
  const top = leading(c);
  const seated = Math.min(12, Math.max(1, c.verdict.total));
  const seats = Array.from({ length: 12 }, (_, i) => i < seated);

  const statusLabel =
    c.status === "in_court"
      ? "In session"
      : c.status === "judgment_pending"
      ? "Jury deliberating"
      : c.status === "decided" || c.status === "legendary"
      ? "Verdict landed"
      : "Calling docket";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface-elevated"
    >
      {/* Courtroom chrome — gold rail + faint scanline */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, var(--c-amber), var(--c-purple), var(--c-teal))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(10,8,15,0.6) 2px, rgba(10,8,15,0.6) 3px)",
        }}
      />

      {/* Top docket bar */}
      <div className="relative flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-[11px]">
        <span
          className="rounded-full border px-2 py-0.5 font-medium uppercase tracking-wider"
          style={{ color: "var(--c-purple)", borderColor: "var(--c-purple)" }}
        >
          {statusLabel}
        </span>
        {c.status === "in_court" && (
          <CountdownChip to={c.closesAt} prefix="Judgment in" />
        )}
        <span className="text-muted-foreground">
          Docket · {c.regionLabel}
        </span>
      </div>

      {/* Bench / emblem */}
      <div className="relative px-4 pt-5 pb-3 text-center border-b border-border">
        <div
          className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] text-xl"
          style={{ borderColor: "var(--c-amber)", background: "var(--c-surface-3)" }}
        >
          ⚖️
        </div>
        <div
          className="text-base font-semibold tracking-wide"
          style={{ color: "var(--c-amber)" }}
        >
          The case before court
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          Where the human decides
        </div>
      </div>

      {/* Case card */}
      <Link
        to="/post/$postId"
        params={{ postId: c.post.id }}
        search={{ shared: 2 }}
        className="block relative px-4 pt-4 pb-3 hover:bg-surface-elevated/60 transition"
      >
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          Case #{c.id.slice(0, 6).toUpperCase()}
        </div>
        <h3 className="text-lg sm:text-xl font-medium leading-snug text-balance">
          {c.post.title}
        </h3>
        {c.post.storyText && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3 italic">
            "{c.post.storyText}"
          </p>
        )}
      </Link>

      {/* Plaintiff / Defendant chairs */}
      <div className="relative grid grid-cols-2 gap-2 px-4 pb-3">
        <ChairCard
          role="Plaintiff"
          state="Testimony filed"
          accent="var(--c-teal)"
          letter="P"
          quote={c.post.storyText ? truncate(c.post.storyText, 80) : null}
        />
        <ChairCard
          role="Defendant"
          state="No response"
          accent="var(--c-coral)"
          letter="D"
          quote={null}
          empty
        />
      </div>

      {/* Jury box */}
      <div className="relative border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
          <span style={{ color: "var(--c-purple)" }}>Jury box</span>
          <span className="flex-1 h-px bg-border" />
          <span>{seated} of 12 seated</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {seats.map((filled, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-md border text-[9px] flex items-center justify-center"
              style={{
                background: filled
                  ? "color-mix(in oklab, var(--c-teal) 12%, transparent)"
                  : "transparent",
                borderColor: filled
                  ? "color-mix(in oklab, var(--c-teal) 40%, transparent)"
                  : "var(--c-border)",
                color: filled ? "var(--c-teal)" : "var(--c-text-3)",
              }}
            >
              {filled ? "•" : ""}
            </div>
          ))}
        </div>
      </div>

      {/* Verdict tally */}
      <div className="relative border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
          <span style={{ color: "var(--c-purple)" }}>Verdict tally</span>
          <span className="flex-1 h-px bg-border" />
          <span>{c.verdict.total} cast</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ORDER.map((k) => {
            const m = VERDICT_META[k];
            const n = (c.verdict.counts as Record<string, number>)[k] ?? 0;
            const pct =
              c.verdict.total > 0 ? Math.round((n / c.verdict.total) * 100) : 0;
            const isTop = top?.kind === k;
            return (
              <div
                key={k}
                className="relative overflow-hidden rounded-md border px-2.5 py-2 text-[11px] flex items-center gap-2"
                style={{
                  borderColor: isTop
                    ? `color-mix(in oklab, ${m.color} 50%, transparent)`
                    : "var(--c-border)",
                  background: isTop
                    ? `color-mix(in oklab, ${m.color} 10%, transparent)`
                    : "transparent",
                  color: isTop ? m.color : "var(--c-text-2)",
                }}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: m.color }}
                />
                <span className="flex-1 truncate">
                  {m.emoji} {m.label}
                </span>
                <span className="font-medium">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA bar */}
      <div className="relative border-t border-border px-4 py-3 flex flex-wrap gap-2 justify-center">
        <Link
          to="/post/$postId"
          params={{ postId: c.post.id }}
          search={{ shared: 2 }}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium"
        >
          ⚖️ Enter the court
        </Link>
        <Link
          to="/spill"
          className="px-4 py-2 rounded-full border border-border-strong text-xs font-medium hover:border-primary/40"
          style={{ color: "var(--c-coral)" }}
        >
          🚩 It happened to me
        </Link>
      </div>
    </motion.section>
  );
}

function ChairCard({
  role,
  state,
  accent,
  letter,
  quote,
  empty,
}: {
  role: string;
  state: string;
  accent: string;
  letter: string;
  quote: string | null;
  empty?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-card p-3 text-center"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 30%, transparent)`,
        opacity: empty ? 0.85 : 1,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: accent }}
      />
      <div
        className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold"
        style={{
          color: accent,
          borderColor: accent,
          background: `color-mix(in oklab, ${accent} 10%, transparent)`,
        }}
      >
        {letter}
      </div>
      <div className="text-[11px] font-medium">{role}</div>
      <div className="text-[10px]" style={{ color: accent }}>
        {state}
      </div>
      {empty ? (
        <div
          className="mt-2 rounded-md border border-dashed px-2 py-1.5 text-[10px] italic"
          style={{
            borderColor: `color-mix(in oklab, ${accent} 30%, transparent)`,
            color: `color-mix(in oklab, ${accent} 60%, var(--c-text-3))`,
          }}
        >
          Empty chair
        </div>
      ) : quote ? (
        <div className="mt-2 rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-left text-[10px] italic text-muted-foreground leading-snug">
          "{quote}"
        </div>
      ) : null}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

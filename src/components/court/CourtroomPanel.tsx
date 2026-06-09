import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Scale,
  Gavel,
  Heart,
  MessageCircle,
  Flag,
  Share2,
  UserX,
} from "lucide-react";
import type { CourtCase } from "@/lib/court.functions";
import { CountdownChip } from "./CountdownChip";

const VERDICT_META: Record<string, { label: string; color: string }> = {
  red_flag: { label: "Red flag", color: "var(--c-red-flag)" },
  green_flag: { label: "Green flag", color: "var(--c-green-flag)" },
  run: { label: "Run", color: "var(--c-run)" },
  talk_it_out: { label: "Talk it out", color: "var(--c-talk)" },
  lawyer_up: { label: "Lawyer up", color: "var(--c-lawyer)" },
  therapy_might_help: { label: "Therapy", color: "var(--c-therapy)" },
  need_update: { label: "Need update", color: "var(--c-update)" },
};

const VERDICT_ORDER = [
  "red_flag",
  "green_flag",
  "run",
  "talk_it_out",
  "lawyer_up",
  "therapy_might_help",
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

  const statusLine =
    c.status === "in_court"
      ? "In session — jury verdict required"
      : c.status === "judgment_pending"
      ? "Bench deliberating"
      : c.status === "decided" || c.status === "legendary"
      ? "Verdict landed"
      : "Calling docket";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-c-border-strong bg-card"
    >
      {/* Ceiling rail */}
      <div
        className="flex items-end justify-center gap-7 border-b border-c-border bg-c-surface-3 py-1.5"
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="h-5 w-[5px] rounded-[1px] bg-c-border-strong" />
        ))}
      </div>

      {/* Court header */}
      <div className="relative border-b border-c-border px-4 pt-4 pb-3 text-center">
        <div className="flex items-center justify-center gap-2 text-c-text-1">
          <Scale className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-lg font-medium tracking-wide">
            Relationship Court™
          </span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-c-text-2">
          Where the human decides
        </div>
        <div className="mx-auto mt-2.5 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-c-border-strong bg-c-surface-3 text-c-text-1">
          <Gavel className="h-6 w-6" strokeWidth={1.5} />
        </div>
      </div>

      {/* Case header */}
      <Link
        to="/post/$postId"
        params={{ postId: c.post.id }}
        search={{ shared: 2 }}
        className="block border-b border-c-border bg-c-surface-2 px-4 py-3 text-center transition hover:bg-c-surface-3"
      >
        <div className="text-[10px] uppercase tracking-[0.1em] text-c-text-2">
          Case No. {c.id.slice(0, 6).toUpperCase()} · {c.regionLabel} · {statusLine}
        </div>
        <h3 className="mt-1 text-sm font-medium leading-snug text-balance text-c-text-1 sm:text-base">
          {c.post.title}
        </h3>
        {c.post.storyText && (
          <p className="mt-1.5 text-[11px] italic text-c-text-2">
            "{truncate(c.post.storyText, 120)}"
          </p>
        )}
        {c.status === "in_court" && (
          <div className="mt-2 inline-flex">
            <CountdownChip to={c.closesAt} prefix="Judgment in" />
          </div>
        )}
      </Link>

      {/* Courtroom floor */}
      <div className="relative px-3 pt-3">
        {/* Bench zone */}
        <div className="relative mb-2.5 rounded-lg border border-c-border bg-c-surface-2 px-3 py-3 text-center">
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.12em] text-c-text-2">
            The bench
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-c-border-strong bg-c-surface-3 text-c-text-1">
              <Scale className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <div className="text-[13px] font-medium text-c-text-1">
                Hon. Public Opinion
              </div>
              <div className="text-[10px] text-c-text-2">
                Presiding — jury verdict required
              </div>
            </div>
          </div>
        </div>

        {/* Parties grid */}
        <div className="grid grid-cols-2 gap-2">
          <PartyZone
            label="Plaintiff"
            letter="P"
            name="The Storyteller"
            status="Testimony filed"
            accent="var(--c-teal)"
            quote={c.post.storyText ? truncate(c.post.storyText, 90) : null}
          />
          <PartyZone
            label="Defendant"
            letter="D"
            name="The Other Side"
            status="No response filed"
            accent="var(--c-coral)"
            quote={null}
            empty
          />
        </div>

        <div className="h-2.5" />

        {/* Jury zone */}
        <div className="mb-2.5 rounded-lg border border-c-border bg-c-surface-2 px-3 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-c-text-1">
              Jury box
            </span>
            <span className="text-[10px] text-c-text-2">
              {seated} of 12 seated
            </span>
          </div>
          <div className="mb-3 flex justify-center gap-1.5">
            {seats.map((filled, i) => (
              <div
                key={i}
                className={
                  "flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[9px] " +
                  (filled
                    ? "border-c-border-strong bg-c-surface-3 text-c-text-1"
                    : "border-c-border bg-transparent text-c-text-3")
                }
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {VERDICT_ORDER.map((k) => {
              const m = VERDICT_META[k];
              const n = (c.verdict.counts as Record<string, number>)[k] ?? 0;
              const pct =
                c.verdict.total > 0 ? Math.round((n / c.verdict.total) * 100) : 0;
              const isTop = top?.kind === k;
              return (
                <div
                  key={k}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px]"
                  style={{
                    borderColor: isTop
                      ? `color-mix(in oklab, ${m.color} 55%, transparent)`
                      : "var(--c-border)",
                    background: isTop
                      ? `color-mix(in oklab, ${m.color} 12%, transparent)`
                      : "transparent",
                    color: isTop ? m.color : "var(--c-text-2)",
                  }}
                >
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: m.color }}
                  />
                  <span className="flex-1 truncate">{m.label}</span>
                  <span className="font-medium">{pct}%</span>
                </div>
              );
            })}
            <div className="col-span-2 flex items-center justify-center gap-2 rounded-md border border-c-border bg-c-surface-3 px-3 py-1.5 text-[11px] font-medium text-c-text-1">
              {top
                ? `${VERDICT_META[top.kind]?.label ?? "Mixed"} · current lead ${top.pct}%`
                : "Awaiting first verdict"}
            </div>
          </div>
        </div>

        {/* Final judgment */}
        <div className="mb-3 rounded-lg border border-c-border bg-c-surface-2 px-3 py-3">
          <div className="mb-2.5 text-center text-[10px] uppercase tracking-[0.12em] text-c-text-2">
            Final judgment
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <JudgmentOpt label="Guilty" color="var(--c-coral)" />
            <JudgmentOpt label="Not guilty" color="var(--c-teal)" />
            <JudgmentOpt label="Both at fault" color="var(--c-update)" />
            <JudgmentOpt label="Need more" color="var(--c-text-3)" />
          </div>
        </div>
      </div>

      {/* Public gallery */}
      <div className="mx-3 mb-3 rounded-lg border border-c-border bg-c-surface-2 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.1em] text-c-text-2">
            Public gallery · {c.post.commentCount}{" "}
            {c.post.commentCount === 1 ? "comment" : "comments"}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-c-text-2">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" strokeWidth={1.5} />
              {c.post.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" strokeWidth={1.5} />
              {c.post.commentCount}
            </span>
          </div>
        </div>
        <Link
          to="/post/$postId"
          params={{ postId: c.post.id }}
          search={{ shared: 2 }}
          className="block border-t border-c-border pt-2 text-[11px] text-c-text-2 hover:text-c-text-1"
        >
          Address the court →
        </Link>
      </div>

      {/* Share row */}
      <div className="flex justify-center gap-2 px-4 pb-4 pt-1">
        <Link
          to="/spill"
          className="inline-flex items-center gap-1.5 rounded-full border border-c-border px-3.5 py-1.5 text-[11px] font-medium text-c-text-1 transition hover:bg-c-surface-3"
        >
          <Flag className="h-3 w-3" strokeWidth={1.5} />
          It happened to me
        </Link>
        <Link
          to="/post/$postId"
          params={{ postId: c.post.id }}
          search={{ shared: 2 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-c-border px-3.5 py-1.5 text-[11px] text-c-text-2 hover:text-c-text-1"
        >
          <Share2 className="h-3 w-3" strokeWidth={1.5} />
          Share this case
        </Link>
      </div>
    </motion.section>
  );
}

function PartyZone({
  label,
  letter,
  name,
  status,
  accent,
  quote,
  empty,
}: {
  label: string;
  letter: string;
  name: string;
  status: string;
  accent: string;
  quote: string | null;
  empty?: boolean;
}) {
  return (
    <div
      className="rounded-lg border border-c-border bg-c-surface-2 p-2.5"
      style={{
        borderTopWidth: 2,
        borderTopColor: accent,
        opacity: empty ? 0.85 : 1,
      }}
    >
      <div
        className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.1em]"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div
        className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-medium"
        style={{
          borderColor: accent,
          color: accent,
          background: `color-mix(in oklab, ${accent} 10%, transparent)`,
        }}
      >
        {empty ? <UserX className="h-3.5 w-3.5" strokeWidth={1.5} /> : letter}
      </div>
      <div className="text-center text-[12px] font-medium text-c-text-1">
        {name}
      </div>
      <div className="text-center text-[10px]" style={{ color: accent }}>
        {status}
      </div>
      {empty ? (
        <div
          className="mt-1.5 rounded-md border border-dashed px-2 py-1.5 text-center text-[10px] text-c-text-2"
          style={{ borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` }}
        >
          Empty chair — has not responded
        </div>
      ) : quote ? (
        <div className="mt-1.5 rounded-md border border-c-border bg-card px-2 py-1.5 text-left text-[11px] italic leading-snug text-c-text-2">
          "{quote}"
        </div>
      ) : null}
    </div>
  );
}

function JudgmentOpt({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="rounded-md border border-c-border bg-c-surface-3 px-2 py-2 text-center text-[12px] font-medium"
      style={{ color }}
    >
      {label}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

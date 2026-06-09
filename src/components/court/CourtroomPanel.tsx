import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { CourtCase } from "@/lib/court.functions";
import { CountdownChip } from "./CountdownChip";

const VERDICT_META: Record<
  string,
  { label: string; color: string }
> = {
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
      className="relative overflow-hidden rounded-2xl border border-border-strong bg-card"
    >
      {/* Ceiling rail — gilded columns */}
      <div
        className="flex items-end justify-center gap-7 border-b py-1.5"
        style={{
          background: "color-mix(in oklab, var(--c-amber) 10%, var(--c-surface-3))",
          borderColor: "color-mix(in oklab, var(--c-amber) 35%, transparent)",
        }}
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-5 w-[5px] rounded-[1px]"
            style={{ background: "var(--c-amber)" }}
          />
        ))}
      </div>

      {/* Court header */}
      <div className="relative border-b border-border px-4 pt-4 pb-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl">⚖️</span>
          <span
            className="text-lg font-medium tracking-wide"
            style={{ color: "var(--c-amber)" }}
          >
            Relationship Court™
          </span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Where the human decides
        </div>
        <div
          className="mx-auto mt-2.5 flex h-14 w-14 items-center justify-center rounded-full border-[2px] text-xl"
          style={{
            borderColor: "var(--c-amber)",
            background: "var(--c-surface-3)",
          }}
        >
          👨‍⚖️
        </div>
      </div>

      {/* Case header */}
      <Link
        to="/post/$postId"
        params={{ postId: c.post.id }}
        search={{ shared: 2 }}
        className="block border-b border-border bg-surface-elevated/40 px-4 py-3 text-center transition hover:bg-surface-elevated/70"
      >
        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Case No. {c.id.slice(0, 6).toUpperCase()} · {c.regionLabel} · {statusLine}
        </div>
        <h3
          className="mt-1 text-sm font-medium leading-snug text-balance sm:text-base"
          style={{ color: "var(--c-amber-strong, var(--c-amber))" }}
        >
          {c.post.title}
        </h3>
        {c.post.storyText && (
          <p className="mt-1.5 text-[11px] italic text-muted-foreground">
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
        <div
          className="relative mb-2.5 rounded-lg border px-3 py-3 text-center"
          style={{
            background: "color-mix(in oklab, var(--c-amber) 8%, var(--c-surface-3))",
            borderColor: "color-mix(in oklab, var(--c-amber) 40%, transparent)",
          }}
        >
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            The bench
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] text-base"
              style={{
                borderColor: "var(--c-amber)",
                background: "var(--c-surface-3)",
              }}
            >
              ⚖️
            </div>
            <div className="text-left">
              <div
                className="text-[13px] font-medium"
                style={{ color: "var(--c-amber)" }}
              >
                Hon. Public Opinion
              </div>
              <div className="text-[10px] text-muted-foreground">
                Presiding — jury verdict required
              </div>
            </div>
          </div>
          <div
            className="absolute -bottom-px left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-t"
            style={{ background: "var(--c-amber)" }}
            aria-hidden
          />
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
        <div className="mb-2.5 rounded-lg border border-border bg-surface-elevated/40 px-3 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span
              className="text-[11px] font-medium uppercase tracking-[0.1em]"
              style={{ color: "var(--c-amber)" }}
            >
              Jury box
            </span>
            <span className="text-[10px] text-muted-foreground">
              {seated} of 12 seated
            </span>
          </div>
          <div className="mb-3 flex justify-center gap-1.5">
            {seats.map((filled, i) => (
              <div
                key={i}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[9px]"
                style={
                  i === 0
                    ? {
                        background: "color-mix(in oklab, var(--c-amber) 18%, transparent)",
                        borderColor: "var(--c-amber)",
                        color: "var(--c-amber)",
                      }
                    : filled
                    ? {
                        background: "var(--c-surface-3)",
                        borderColor: "var(--c-amber)",
                        color: "var(--c-amber)",
                      }
                    : {
                        background: "transparent",
                        borderColor: "var(--c-border)",
                        color: "var(--c-text-3)",
                      }
                }
              >
                {i === 0 ? "Y" : ""}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {VERDICT_ORDER.map((k) => {
              const m = VERDICT_META[k];
              const n = (c.verdict.counts as Record<string, number>)[k] ?? 0;
              const pct =
                c.verdict.total > 0
                  ? Math.round((n / c.verdict.total) * 100)
                  : 0;
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
            {/* Leading lane — full row */}
            <div
              className="col-span-2 flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-medium"
              style={{
                borderColor: "color-mix(in oklab, var(--c-update) 50%, transparent)",
                background: "color-mix(in oklab, var(--c-update) 12%, transparent)",
                color: "var(--c-update)",
              }}
            >
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--c-update)" }}
              />
              {top
                ? `${VERDICT_META[top.kind]?.label ?? "Mixed"} · current lead ${top.pct}%`
                : "Awaiting first verdict"}
            </div>
          </div>
        </div>

        {/* Floor line */}
        <div
          className="mb-2.5 h-[2px] rounded"
          style={{ background: "color-mix(in oklab, var(--c-amber) 35%, transparent)" }}
          aria-hidden
        />

        {/* Final judgment */}
        <div
          className="mb-3 rounded-lg border px-3 py-3"
          style={{
            background: "color-mix(in oklab, var(--c-amber) 8%, var(--c-surface-3))",
            borderColor: "color-mix(in oklab, var(--c-amber) 40%, transparent)",
          }}
        >
          <div
            className="mb-2.5 text-center text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "var(--c-amber)" }}
          >
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
      <div className="mx-3 mb-3 rounded-lg border border-border bg-surface-elevated/40 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Public gallery · {c.post.commentCount} {c.post.commentCount === 1 ? "comment" : "comments"}
          </span>
          <div className="flex gap-2.5 text-[11px] text-muted-foreground">
            <span>♥ {c.post.likeCount}</span>
            <span>💬 {c.post.commentCount}</span>
          </div>
        </div>
        <Link
          to="/post/$postId"
          params={{ postId: c.post.id }}
          search={{ shared: 2 }}
          className="block border-t border-border pt-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Address the court →
        </Link>
      </div>

      {/* Share row */}
      <div className="flex justify-center gap-2 px-4 pb-4 pt-1">
        <Link
          to="/spill"
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition"
          style={{
            borderColor: "color-mix(in oklab, var(--c-coral) 45%, transparent)",
            color: "var(--c-coral)",
          }}
        >
          🚩 It happened to me
        </Link>
        <Link
          to="/post/$postId"
          params={{ postId: c.post.id }}
          search={{ shared: 2 }}
          className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          ↗ Share this case
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
      className="rounded-lg border border-border bg-surface-elevated/40 p-2.5"
      style={{
        borderTopWidth: 2,
        borderTopColor: accent,
        opacity: empty ? 0.78 : 1,
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
        {letter}
      </div>
      <div
        className="text-center text-[12px] font-medium"
        style={{ color: "var(--c-amber)" }}
      >
        {name}
      </div>
      <div className="text-center text-[10px]" style={{ color: accent }}>
        {status}
      </div>
      {empty ? (
        <div
          className="mt-1.5 rounded-md border border-dashed px-2 py-1.5 text-center text-[10px]"
          style={{
            borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
            color: `color-mix(in oklab, ${accent} 60%, var(--c-text-3))`,
          }}
        >
          Empty chair — has not responded
        </div>
      ) : quote ? (
        <div className="mt-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-left text-[11px] italic leading-snug text-muted-foreground">
          "{quote}"
        </div>
      ) : null}
    </div>
  );
}

function JudgmentOpt({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="rounded-md border px-2 py-2 text-center text-[12px] font-medium"
      style={{
        borderColor: "var(--c-border)",
        background: "var(--c-surface-3)",
        color,
      }}
    >
      {label}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

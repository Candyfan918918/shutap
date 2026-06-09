import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CourtCase } from "@/lib/court.functions";
import { castVerdict } from "@/lib/vote.functions";
import { CountdownChip } from "./CountdownChip";

type VerdictKey =
  | "red_flag"
  | "green_flag"
  | "run"
  | "talk_it_out"
  | "lawyer_up"
  | "therapy_might_help"
  | "need_update";

const VERDICTS: Array<{
  key: VerdictKey;
  label: string;
  emoji: string;
  color: string;
  full?: boolean;
}> = [
  { key: "red_flag",          label: "Red flag",     emoji: "🚩", color: "var(--c-red-flag)" },
  { key: "green_flag",        label: "Green flag",   emoji: "💚", color: "var(--c-green-flag)" },
  { key: "run",               label: "Run",          emoji: "🏃", color: "var(--c-run)" },
  { key: "talk_it_out",       label: "Talk it out",  emoji: "🗣️", color: "var(--c-talk)" },
  { key: "lawyer_up",         label: "Lawyer up",    emoji: "⚖️", color: "var(--c-lawyer)" },
  { key: "therapy_might_help",label: "Therapy",      emoji: "🛋️", color: "var(--c-therapy)" },
  { key: "need_update",       label: "Need update",  emoji: "👀", color: "var(--c-update)", full: true },
];

type JudgmentKey = "guilty" | "notguilty" | "fault" | "more";
const JUDGMENTS: Array<{ key: JudgmentKey; label: string; color: string; bg: string }> = [
  { key: "guilty",    label: "Guilty",         color: "var(--c-coral)",  bg: "#fdf0ee" },
  { key: "notguilty", label: "Not guilty",     color: "var(--c-teal)",   bg: "#e8f7f3" },
  { key: "fault",     label: "Both at fault",  color: "var(--c-amber)",  bg: "#fffaee" },
  { key: "more",      label: "Need more info", color: "var(--c-text-2)", bg: "var(--c-surface-3)" },
];

const JUROR_INITIALS = ["MK","JL","ST","AR","BW","OT","CL","FN","PD","ZK","RY"];

const ACCENT = "var(--c-amber)";       // pink is reserved for auth — court accent = amber
const ACCENT_SOFT = "#fffaee";
const ACCENT_DEEP = "#7a4a00";

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export function CourtroomPanel({ c }: { c: CourtCase }) {
  if (!c.post) return null;

  const cast = useServerFn(castVerdict);
  const router = useRouter();
  const navigate = useNavigate();

  // Auth state — every CTA in the courtroom requires sign-in.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIsAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session?.user);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  function requireAuth(): boolean {
    if (isAuthed) return true;
    const redirect = typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/court";
    navigate({ to: "/auth", search: { redirect } as any });
    return false;
  }

  const [myVote, setMyVote] = useState<VerdictKey | null>(null);
  const [myJudgment, setMyJudgment] = useState<JudgmentKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitState, setSubmitState] = useState<"idle"|"submitting"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fillerSeats, setFillerSeats] = useState<string[]>([]); // AI-filled extra seats (post-vote)
  const [comments, setComments] = useState<Array<{ who: string; when: string; text: string; initials: string }>>([
    {
      who: "Austin · CEO Energy",
      when: "",
      initials: "AC",
      text: "Honestly, here's what I'd do: take the Seoul exit and never look back. Four cities of lies is four too many.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [liked, setLiked] = useState(false);
  const [shareLabel, setShareLabel] = useState("🔗 Share this case");

  // Live tally with optimistic +1 for myVote.
  const tally = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const v of VERDICTS) {
      const n = (c.verdict.counts as Record<string, number>)[v.key] ?? 0;
      counts[v.key] = n;
      total += n;
    }
    if (myVote) {
      counts[myVote] = (counts[myVote] ?? 0) + 1;
      total += 1;
    }
    return { counts, total };
  }, [c.verdict.counts, myVote]);

  const totalVotes = c.verdict.total + (myVote ? 1 : 0);

  // Jury seats: "You" + counted seated from real tally + filler seats accrued from vote.
  const seatedFromVotes = Math.min(11, Math.max(0, c.verdict.total));
  const seats = useMemo(() => {
    const arr: Array<{ kind: "you" | "filled" | "empty"; label?: string }> = [];
    arr.push({ kind: "you", label: "Y" });
    let placed = 0;
    // pre-existing seated jurors (anonymous)
    for (let i = 0; i < seatedFromVotes && placed < 11; i++, placed++) {
      arr.push({ kind: "filled", label: "·" });
    }
    // freshly added filler from this session's vote
    for (let i = 0; i < fillerSeats.length && placed < 11; i++, placed++) {
      arr.push({ kind: "filled", label: fillerSeats[i] });
    }
    while (arr.length < 12) arr.push({ kind: "empty" });
    return arr;
  }, [seatedFromVotes, fillerSeats]);

  const seatedCount = 1 + Math.min(11, seatedFromVotes + fillerSeats.length);

  function pickVote(k: VerdictKey) {
    if (submitted) return;
    if (!requireAuth()) return;
    setMyVote(k);
    if (fillerSeats.length === 0) {
      const init = JUROR_INITIALS[Math.floor(Math.random() * JUROR_INITIALS.length)];
      setFillerSeats([init]);
    }
  }

  function pickJudgment(k: JudgmentKey) {
    if (submitted) return;
    if (!requireAuth()) return;
    setMyJudgment(k);
  }

  async function onSubmit() {
    if (!myVote || !myJudgment || submitted) return;
    if (!requireAuth()) return;
    setSubmitState("submitting");
    setErrorMsg(null);
    try {
      await cast({
        data: { story_id: c.post!.id, verdict: myVote, read_depth_percent: 80 },
      });
      setSubmitted(true);
      setSubmitState("done");
    } catch (e: any) {
      setSubmitted(true);
      setSubmitState("error");
      setErrorMsg(e?.message ?? "Verdict not recorded.");
    }
  }

  function submitComment() {
    if (!requireAuth()) return;
    const t = draft.trim();
    if (!t) return;
    setComments((cs) => [
      ...cs,
      { who: "You · just now", when: "", initials: "Y", text: t },
    ]);
    setDraft("");
  }

  async function shareCase() {
    if (!requireAuth()) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Relationship Court",
          text: c.post!.title,
          url,
        });
      } catch { /* user cancel */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel("✓ Link copied");
      setTimeout(() => setShareLabel("🔗 Share this case"), 2000);
    } catch { /* ignore */ }
  }

  function toggleLike() {
    if (!requireAuth()) return;
    setLiked((v) => !v);
  }

  const benchInsight =
    myJudgment === "guilty"    ? "the plaintiff" :
    myJudgment === "notguilty" ? "a complex read" :
    myJudgment === "fault"     ? "a shared-fault view" :
                                 "the need for more";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface)" }}
    >
      {/* Court header */}
      <div
        className="px-4 pt-5 pb-4 text-center"
        style={{ borderBottom: ".5px solid var(--c-border)" }}
      >
        <div
          className="mx-auto mb-2.5 flex h-[52px] w-[52px] items-center justify-center rounded-full text-[22px]"
          style={{
            background: ACCENT_SOFT,
            border: `1.5px solid ${ACCENT}`,
          }}
        >
          ⚖️
        </div>
        <div className="text-[18px] font-medium tracking-tight" style={{ color: "var(--c-text-1)" }}>
          Relationship Court™
        </div>
        <div
          className="mt-0.5 text-[11px] uppercase tracking-[0.06em]"
          style={{ color: "var(--c-text-3)" }}
        >
          Where the public decides
        </div>
      </div>

      {/* Case card */}
      <Link
        to="/post/$postId"
        params={{ postId: c.post.id }}
        search={{ shared: 2 }}
        className="block px-4 py-3.5 text-center transition hover:opacity-90"
        style={{
          background: "var(--c-surface-2)",
          borderBottom: ".5px solid var(--c-border)",
        }}
      >
        <div
          className="mb-1 text-[10px] uppercase tracking-[0.08em]"
          style={{ color: "var(--c-text-3)" }}
        >
          Case No. {c.id.slice(0, 6).toUpperCase()} · {c.regionLabel} · {c.status === "in_court" ? "In session" : "On record"}
        </div>
        <div className="text-[14px] font-medium leading-snug" style={{ color: "var(--c-text-1)" }}>
          {c.post.title}
        </div>
        <div className="mt-2 text-[11px] italic" style={{ color: "var(--c-text-2)" }}>
          Question before court: What would you do?
        </div>
        {c.status === "in_court" && c.closesAt && (
          <div className="mt-2 inline-flex">
            <CountdownChip to={c.closesAt} prefix="Judgment in" />
          </div>
        )}
      </Link>

      {/* Bench */}
      <div
        className="mx-3 mt-3.5 flex items-center gap-3 rounded-xl px-3.5 py-3"
        style={{
          background: "var(--c-surface-2)",
          border: ".5px solid var(--c-border)",
          borderLeft: `2px solid ${ACCENT}`,
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{ background: ACCENT_SOFT, border: `1.5px solid ${ACCENT}` }}
        >
          ⚖️
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
            The bench
          </div>
          <div className="text-[13px] font-medium" style={{ color: "var(--c-text-1)" }}>
            Hon. Public Opinion
          </div>
          <div className="text-[11px]" style={{ color: "var(--c-text-2)" }}>
            Presiding — jury verdict required
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
        <PartyCard
          label="Plaintiff"
          letter="P"
          name="The Storyteller"
          status="Testimony filed"
          accent="var(--c-teal)"
          accentBg="#e8f7f3"
          quote={c.post.storyText ? truncate(c.post.storyText, 110) : null}
        />
        <PartyCard
          label="Defendant"
          letter="D"
          name="The Other Side"
          status="No response filed"
          accent="var(--c-coral)"
          accentBg="#fdf0ee"
          empty
        />
      </div>

      {/* Verdict bar */}
      <div className="mx-3 mt-3.5">
        <div className="mb-1.5 text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--c-text-3)" }}>
          Current verdict — {totalVotes.toLocaleString()} votes
        </div>
        <div
          className="flex h-2 gap-px overflow-hidden rounded-md"
          style={{ background: "var(--c-surface-3)" }}
        >
          {VERDICTS.map((v) => {
            const pct = tally.total > 0 ? (tally.counts[v.key] / tally.total) * 100 : 0;
            return (
              <span
                key={v.key}
                className="transition-[flex-basis] duration-500"
                style={{ flexBasis: `${pct}%`, background: v.color }}
              />
            );
          })}
        </div>
      </div>

      {/* Jury zone */}
      <div
        className="mx-3 mt-3 rounded-xl p-3"
        style={{ background: "var(--c-surface-2)", border: ".5px solid var(--c-border)" }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--c-text-2)" }}>
            Jury box
          </span>
          <span className="text-[10px]" style={{ color: "var(--c-text-3)" }}>
            {seatedCount} of 12 seated
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {seats.map((s, i) => (
            <div
              key={i}
              title={s.kind === "you" ? "You" : s.kind === "filled" ? "Juror" : "Empty"}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px]"
              style={
                s.kind === "you"
                  ? { background: ACCENT_SOFT, border: `0.5px solid ${ACCENT}`, color: ACCENT_DEEP, fontWeight: 500 }
                  : s.kind === "filled"
                  ? { background: "var(--c-surface-3)", border: ".5px solid var(--c-border-strong)", color: "var(--c-text-2)" }
                  : { background: "var(--c-surface)", border: ".5px solid var(--c-border-strong)", color: "var(--c-text-3)" }
              }
            >
              {s.label ?? ""}
            </div>
          ))}
        </div>
      </div>

      {/* Verdict buttons */}
      <div className="mt-3 px-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--c-text-3)" }}>
          Cast your verdict
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {VERDICTS.map((v) => {
            const active = myVote === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => pickVote(v.key)}
                disabled={submitted}
                className={
                  "flex items-center gap-1.5 rounded-xl px-2 py-2.5 text-left text-[12px] font-medium transition disabled:cursor-not-allowed" +
                  (v.full ? " col-span-3 justify-center" : "")
                }
                style={
                  active
                    ? { background: ACCENT_SOFT, border: `0.5px solid ${ACCENT}`, color: ACCENT_DEEP }
                    : { background: "var(--c-surface-2)", border: ".5px solid var(--c-border)", color: "var(--c-text-1)" }
                }
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: v.color }} />
                <span>{v.emoji} {v.label}{v.full ? " — current lead" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Judgment buttons */}
      <div className="mt-3.5 px-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--c-text-3)" }}>
          Final judgment
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {JUDGMENTS.map((j) => {
            const active = myJudgment === j.key;
            return (
              <button
                key={j.key}
                type="button"
                onClick={() => pickJudgment(j.key)}
                disabled={submitted}
                className="rounded-xl px-3 py-2.5 text-[13px] font-medium transition disabled:cursor-not-allowed"
                style={
                  active
                    ? { background: j.bg, border: `0.5px solid ${j.color}`, color: j.color }
                    : { background: "var(--c-surface-2)", border: ".5px solid var(--c-border)", color: "var(--c-text-1)" }
                }
              >
                {j.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit CTA */}
      <div className="mt-2.5 px-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!myVote || !myJudgment || submitted || submitState === "submitting"}
          className="w-full rounded-xl px-4 py-3 text-[14px] font-medium transition disabled:cursor-not-allowed"
          style={
            !myVote || !myJudgment || submitted
              ? { background: "var(--c-surface-3)", color: "var(--c-text-3)" }
              : { background: ACCENT, color: "#fff" }
          }
        >
          {submitState === "submitting"
            ? "Recording…"
            : submitted
            ? "Verdict recorded ✓"
            : "Submit your verdict"}
        </button>
      </div>

      {/* Toast */}
      {submitted && submitState === "done" && (
        <div
          className="mx-3 mt-2.5 rounded-xl px-3.5 py-2.5 text-center text-[12px] font-medium"
          style={{ background: "#e8f7f3", border: ".5px solid var(--c-teal)", color: "var(--c-teal)" }}
        >
          ✓ Verdict submitted — you're on the record.
        </div>
      )}
      {submitted && submitState === "error" && errorMsg && (
        <div
          className="mx-3 mt-2.5 rounded-xl px-3.5 py-2.5 text-center text-[12px]"
          style={{ background: "var(--c-surface-2)", border: ".5px dashed var(--c-border-strong)", color: "var(--c-text-2)" }}
        >
          {errorMsg}
        </div>
      )}

      {/* Bench AI nudge */}
      {submitted && (
        <div
          className="mx-3 mt-3.5 pl-3.5 text-[13px] italic leading-[1.7]"
          style={{ borderLeft: `2px solid ${ACCENT}`, color: "var(--c-text-2)" }}
        >
          You've sided with <strong style={{ color: "var(--c-text-1)", fontStyle: "normal" }}>{benchInsight}</strong>.{" "}
          74% of people in your region agree.
          <br />
          <Link
            to="/spill"
            className="mt-1.5 inline-block text-[12px] font-medium underline underline-offset-[3px]"
            style={{ color: ACCENT, fontStyle: "normal" }}
          >
            Is there a story you haven't told yet? →
          </Link>
        </div>
      )}

      {/* Trust bar */}
      <div
        className="mt-4 flex items-center justify-between px-3.5 py-2 text-[12px]"
        style={{
          background: "var(--c-surface-2)",
          borderTop: ".5px solid var(--c-border)",
          borderBottom: ".5px solid var(--c-border)",
          color: "var(--c-text-2)",
        }}
      >
        <span>
          <span className="font-medium" style={{ color: "var(--c-text-1)" }}>
            {totalVotes.toLocaleString()}
          </span>{" "}
          verdicts cast
        </span>
        <span>Zero real names exposed.</span>
      </div>

      {/* Public gallery */}
      <div className="mx-3 mt-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--c-text-3)" }}>
            Public gallery · {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </span>
          <div className="flex gap-2.5 text-[11px]" style={{ color: "var(--c-text-3)" }}>
            <span>❤️ {(c.post.likeCount + (liked ? 1 : 0)).toLocaleString()}</span>
            <span>💬 {c.post.commentCount + comments.length - 1}</span>
          </div>
        </div>
        <div>
          {comments.map((cm, i) => (
            <div
              key={i}
              className="flex gap-2 py-2"
              style={{ borderTop: ".5px solid var(--c-border)" }}
            >
              <div
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-medium"
                style={
                  cm.who.startsWith("You")
                    ? { background: ACCENT_SOFT, color: ACCENT_DEEP, border: ".5px solid var(--c-border-strong)" }
                    : { background: "var(--c-surface-3)", color: ACCENT_DEEP, border: ".5px solid var(--c-border-strong)" }
                }
              >
                {cm.initials}
              </div>
              <div>
                <div className="mb-0.5 text-[10px]" style={{ color: "var(--c-text-3)" }}>
                  {cm.who}
                </div>
                <div className="text-[12px] leading-[1.5]" style={{ color: "var(--c-text-1)" }}>
                  {cm.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <input
            value={draft}
            onFocus={(e) => { if (!isAuthed) { e.currentTarget.blur(); requireAuth(); } }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
            placeholder={isAuthed ? "Address the court..." : "Sign in to address the court"}
            className="flex-1 rounded-xl px-3 py-2.5 text-[12px] outline-none transition"
            style={{
              background: "var(--c-surface)",
              border: ".5px solid var(--c-border-strong)",
              color: "var(--c-text-1)",
            }}
          />
          <button
            type="button"
            onClick={submitComment}
            className="whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[12px] font-medium text-white transition"
            style={{ background: ACCENT }}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Share row */}
      <div className="mt-3.5 flex justify-center gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={toggleLike}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition"
          style={
            liked
              ? { background: ACCENT_SOFT, border: `0.5px solid ${ACCENT}`, color: ACCENT_DEEP }
              : { background: "var(--c-surface-2)", border: ".5px solid var(--c-border-strong)", color: "var(--c-text-2)" }
          }
        >
          🙋 It happened to me
        </button>
        <button
          type="button"
          onClick={shareCase}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition"
          style={{ background: "var(--c-surface-2)", border: ".5px solid var(--c-border-strong)", color: "var(--c-text-2)" }}
        >
          {shareLabel}
        </button>
      </div>
    </motion.section>
  );
}

function PartyCard({
  label,
  letter,
  name,
  status,
  accent,
  accentBg,
  quote,
  empty,
}: {
  label: string;
  letter: string;
  name: string;
  status: string;
  accent: string;
  accentBg: string;
  quote?: string | null;
  empty?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "var(--c-surface-2)",
        border: ".5px solid var(--c-border)",
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.08em]" style={{ color: accent }}>
        {label}
      </div>
      <div
        className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium"
        style={{ background: accentBg, border: `1px solid ${accent}`, color: accent }}
      >
        {letter}
      </div>
      <div className="text-center text-[12px] font-medium" style={{ color: "var(--c-text-1)" }}>
        {name}
      </div>
      <div className="text-center text-[10px]" style={{ color: accent }}>
        {status}
      </div>
      {empty ? (
        <div
          className="mt-2 rounded-md px-2 py-1.5 text-center text-[11px]"
          style={{
            background: "var(--c-surface)",
            border: ".5px dashed var(--c-border-strong)",
            color: "var(--c-text-3)",
          }}
        >
          Empty chair — has not responded
        </div>
      ) : quote ? (
        <div
          className="mt-2 rounded-md px-2 py-1.5 text-[11px] italic leading-[1.5]"
          style={{
            background: "var(--c-surface)",
            border: ".5px solid var(--c-border)",
            color: "var(--c-text-2)",
          }}
        >
          "{quote}"
        </div>
      ) : null}
    </div>
  );
}

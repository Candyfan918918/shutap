// Identity ceremony — the soft gate. The reels spin, the user verifies, the alias appears.
// Nothing in the underlying page executes until the user claims an identity here.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useGateStore, type PendingAction } from "@/stores/gate";
import {
  generateAlias,
  claimAlias,
  type GeneratedAlias,
} from "@/lib/alias.functions";
import { verifyAge } from "@/lib/auth-age-gate.functions";
import { castVerdict } from "@/lib/posts/community.functions";
import { reactToPost } from "@/lib/posts/engagement.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SlotReel, clickTone } from "@/components/identity/SlotReel";
import { UnderageBlock } from "@/components/gate/UnderageBlock";
import { toast } from "sonner";


type Phase =
  | "auth"
  | "dob"
  | "underage"
  | "spin"
  | "reveal"
  | "confirming"
  | "done";

const EMOJI_OPTIONS = ["🦊", "🦉", "🐙", "🦋", "🌙", "⚡", "🌸", "🔥", "🎭", "👁", "🪞", "⚖️"];

export const RESUME_KEY = "md.gate.resume";

function stashPending(p: PendingAction) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(p));
  } catch {/* silent */}
}

// Click tone now imported from SlotReel for one canonical implementation.


export function IdentityCeremony() {
  const open = useGateStore((s) => s.open);
  const pending = useGateStore((s) => s.pending);
  const close = useGateStore((s) => s.close);

  if (!open || !pending) return null;
  return <Ceremony pending={pending} onClose={close} />;
}

function Ceremony({ pending, onClose }: { pending: PendingAction; onClose: () => void }) {
  // If a session already exists (e.g. user returned from OAuth redirect), skip auth.
  const [phase, setPhase] = useState<Phase>("auth");
  const [dobMonth, setDobMonth] = useState<number>(1);
  const [dobYear, setDobYear] = useState<number>(new Date().getFullYear() - 25);
  const [alias, setAlias] = useState<GeneratedAlias | null>(null);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [emoji, setEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [locks, setLocks] = useState<{ n: boolean; e: boolean; c: boolean }>({ n: false, e: false, c: false });
  const [reelSpeed] = useState<"full" | "slow">("full");
  const [confirmingStep, setConfirmingStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);

  const fetchAlias = useServerFn(generateAlias);
  const submitAge = useServerFn(verifyAge);
  const claim = useServerFn(claimAlias);
  const sendVerdict = useServerFn(castVerdict);
  const sendReact = useServerFn(reactToPost);
  const qc = useQueryClient();

  // Detect existing session — skip the auth card if already signed in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPhase((p) => (p === "auth" ? "dob" : p));
    });
  }, []);

  // Kick off alias prefetch the moment the ceremony opens.
  useEffect(() => {
    fetchAlias({
      data: {
        category: pending.context?.category,
        relationshipType: pending.context?.relationshipType,
      },
    })
      .then((a) => setAlias(a))
      .catch(() => {/* fall through */});
  }, [fetchAlias, pending.context?.category, pending.context?.relationshipType]);

  const replay = async (action: PendingAction) => {
    try {
      if (action.type === "vote" && action.entityId && action.verdictKind) {
        await sendVerdict({ data: { postId: action.entityId, kind: action.verdictKind as never } });
      } else if (action.type === "relate" && action.entityId) {
        await sendReact({ data: { postId: action.entityId, kind: "been_there" } });
      }
      qc.invalidateQueries();
    } catch {/* silent */}
  };

  const onAgeSubmit = async () => {
    const dob = `${dobYear}-${String(dobMonth).padStart(2, "0")}-15`;
    setBusy(true);
    try {
      const res = await submitAge({ data: { dob } });
      if (!res.ageOk) { setPhase("underage"); return; }
      setPhase("spin");
    } finally { setBusy(false); }
  };

  // ── Spin sequence: full speed, then lock left/middle/right
  useEffect(() => {
    if (phase !== "spin") return;
    if (!alias) {
      fetchAlias({
        data: {
          category: pending.context?.category,
          relationshipType: pending.context?.relationshipType,
        },
      }).then((a) => setAlias(a));
      return;
    }
    setLocks({ n: false, e: false, c: false });
    const t1 = window.setTimeout(() => { setLocks((l) => ({ ...l, n: true })); clickTone(440); }, 2000);
    const t2 = window.setTimeout(() => { setLocks((l) => ({ ...l, e: true })); clickTone(460); }, 2200);
    const t3 = window.setTimeout(() => { setLocks((l) => ({ ...l, c: true })); clickTone(480); }, 2400);
    const t4 = window.setTimeout(() => setPhase("reveal"), 3200);
    return () => {
      window.clearTimeout(t1); window.clearTimeout(t2);
      window.clearTimeout(t3); window.clearTimeout(t4);
    };
  }, [phase, alias, fetchAlias, pending.context?.category, pending.context?.relationshipType]);

  const onReroll = async () => {
    if (rerollUsed) return;
    setRerollUsed(true);
    setAlias(null);
    setPhase("spin");
    const fresh = await fetchAlias({
      data: {
        category: pending.context?.category,
        relationshipType: pending.context?.relationshipType,
      },
    });
    setAlias(fresh);
  };

  const onClaim = async () => {
    if (!alias) return;
    setBusy(true);
    setPhase("confirming");
    setConfirmingStep(0);
    try {
      await claim({
        data: {
          nationality: alias.nationality,
          emotion: alias.emotion,
          creature: alias.creature,
          emoji,
          rerollUsed,
        },
      });
      setConfirmingStep(1);
      await new Promise((r) => setTimeout(r, 900));
      setConfirmingStep(2);
      await new Promise((r) => setTimeout(r, 900));
      try { sessionStorage.removeItem(RESUME_KEY); } catch {/* silent */}
      await replay(pending);
      setPhase("done");
      setTimeout(() => onClose(), 450);
    } catch {
      setPhase("reveal");
    } finally {
      setBusy(false);
    }
  };

  // ── Underage hard block
  if (phase === "underage") {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-5xl">⚖️</p>
          <p className="text-xl font-medium text-white">Shutap is for adults 18 and older.</p>
          <p className="text-sm text-white/70">Come back when you're ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/70  pointer-events-auto"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-md bg-card border-t border-x border-border rounded-t-3xl  pointer-events-auto overflow-hidden"
      >
        <BenchLine phase={phase} />
        <SlotMachine alias={alias} locks={locks} speed={reelSpeed} phase={phase} />
        <AliasLine phase={phase} alias={alias} locks={locks} />

        <div className="p-5 pt-2 space-y-3">
          {phase === "auth" && <AuthCard pending={pending} />}
          {phase === "dob" && (
            <DobCard
              month={dobMonth} year={dobYear}
              onMonth={setDobMonth} onYear={setDobYear}
              onSubmit={onAgeSubmit} busy={busy}
            />
          )}
          {phase === "reveal" && (
            <RevealCard
              emoji={emoji} onEmoji={setEmoji}
              onClaim={onClaim} onReroll={onReroll}
              rerollUsed={rerollUsed} busy={busy}
            />
          )}
          {phase === "confirming" && <ConfirmCard step={confirmingStep} />}
        </div>
      </motion.div>
    </div>
  );
}

function BenchLine({ phase }: { phase: Phase }) {
  const text =
    phase === "auth" ? "The court is assigning your identity."
    : phase === "dob" ? "The court asks one last thing."
    : phase === "spin" ? "Hold. The reels are deciding."
    : phase === "reveal" ? "The court has spoken."
    : "";
  if (!text) return <div className="h-6" />;
  return (
    <p className="px-5 pt-4 pb-1 text-center text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
      {text}
    </p>
  );
}

function SlotMachine({
  alias, locks, speed, phase,
}: {
  alias: GeneratedAlias | null;
  locks: { n: boolean; e: boolean; c: boolean };
  speed: "full" | "slow";
  phase: Phase;
}) {
  const pools = alias?.reelPools ?? { nationality: ["…"], emotion: ["…"], creature: ["…"] };
  const dimmed = phase === "auth" || phase === "dob";
  return (
    <div className={`px-5 pt-3 transition ${dimmed ? "opacity-70" : ""}`}>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-elevated border border-border p-3">
        <Reel pool={pools.nationality} locked={locks.n} value={alias?.nationality ?? "…"} speed={speed} />
        <Reel pool={pools.emotion} locked={locks.e} value={alias?.emotion ?? "…"} speed={speed} />
        <Reel pool={pools.creature} locked={locks.c} value={alias?.creature ?? "…"} speed={speed} />
      </div>
    </div>
  );
}

function Reel({
  pool, locked, value, speed,
}: { pool: string[]; locked: boolean; value: string; speed: "full" | "slow" }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (locked) return;
    const interval = speed === "full" ? 70 : 130;
    const id = window.setInterval(() => setTick((t) => t + 1), interval);
    return () => window.clearInterval(id);
  }, [locked, speed]);
  const display = locked ? value : pool[tick % pool.length] ?? "…";
  return (
    <motion.div
      animate={locked ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`h-14 rounded-xl flex items-center justify-center text-center px-2 font-medium text-[13px] sm:text-sm leading-tight ${
        locked
          ? "bg-primary border border-primary/50 text-foreground"
          : "bg-background border border-border text-muted-foreground"
      }`}
    >
      <span className="truncate">{display}</span>
    </motion.div>
  );
}

function AliasLine({
  phase, alias, locks,
}: {
  phase: Phase; alias: GeneratedAlias | null;
  locks: { n: boolean; e: boolean; c: boolean };
}) {
  if (phase !== "spin" && phase !== "reveal" && phase !== "confirming") return null;
  if (!alias) return null;
  const parts: string[] = ["You are"];
  if (locks.n || phase !== "spin") parts.push(alias.nationality);
  if (locks.e || phase !== "spin") parts.push(alias.emotion);
  if (locks.c || phase !== "spin") parts.push(alias.creature);
  const text = parts.join(" ") + (locks.c || phase !== "spin" ? "." : "...");
  return (
    <p className="px-5 pt-3 text-center text-base sm:text-lg font-medium">{text}</p>
  );
}

// ── Auth card (Email magic link / Google / Apple)

function AuthCard({ pending }: { pending: PendingAction }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"idle" | "email" | "google" | "apple">("idle");

  const stash = () => stashPending(pending);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy !== "idle" || !email.includes("@")) return;
    setBusy("email");
    try {
      stash();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
      toast.success("Check your email for the sign-in link.");
      setBusy("idle");
    } catch {
      toast.error("Couldn't send the link. Try again.");
      setBusy("idle");
    }
  };

  const onOauth = async (provider: "google" | "apple") => {
    if (busy !== "idle") return;
    setBusy(provider);
    try {
      stash();
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}${window.location.pathname}`,
      });
      if (result.error) {
        toast.error("Sign-in failed. Try again.");
        setBusy("idle");
      }
    } catch {
      toast.error("Sign-in failed. Try again.");
      setBusy("idle");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <p className="text-sm font-medium">Continue to claim your identity.</p>
      <form onSubmit={onEmail} className="space-y-2">
        <input
          type="email" inputMode="email" autoComplete="email" required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy !== "idle" || !email.includes("@")}
          className="w-full rounded-full bg-primary text-primary-foreground font-medium text-sm py-2.5 disabled:opacity-50"
        >
          {busy === "email" ? "Sending…" : "Continue with email →"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex-1 h-px bg-border" /><span>or</span><div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onOauth("google")}
          disabled={busy !== "idle"}
          className="w-full py-2.5 rounded-full bg-background border border-border font-medium text-sm disabled:opacity-60"
        >
          {busy === "google" ? "…" : "🔵  Continue with Google"}
        </button>
        <button
          onClick={() => onOauth("apple")}
          disabled={busy !== "idle"}
          className="w-full py-2.5 rounded-full bg-background border border-border font-medium text-sm disabled:opacity-60"
        >
          {busy === "apple" ? "…" : "🍎  Continue with Apple"}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Zero real names exposed. Your email is never shown on the court.
      </p>
    </div>
  );
}

// ── DOB card

function DobCard({
  month, year, onMonth, onYear, onSubmit, busy,
}: {
  month: number; year: number;
  onMonth: (m: number) => void; onYear: (y: number) => void;
  onSubmit: () => void; busy: boolean;
}) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <p className="text-sm font-medium">When were you born?</p>
      <div className="flex gap-2">
        <select value={month} onChange={(e) => onMonth(parseInt(e.target.value, 10))}
          className="flex-1 rounded-lg bg-background border border-border px-2 py-2 text-sm">
          {months.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
        </select>
        <select value={year} onChange={(e) => onYear(parseInt(e.target.value, 10))}
          className="w-32 rounded-lg bg-background border border-border px-2 py-2 text-sm">
          {years.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
      </div>
      <button onClick={onSubmit} disabled={busy}
        className="w-full rounded-full bg-primary text-primary-foreground font-medium text-sm py-2.5 disabled:opacity-50">
        {busy ? "Checking…" : "I'm 18 or older →"}
      </button>
    </div>
  );
}

// ── Reveal card

function RevealCard({
  emoji, onEmoji, onClaim, onReroll, rerollUsed, busy,
}: {
  emoji: string; onEmoji: (v: string) => void;
  onClaim: () => void; onReroll: () => void;
  rerollUsed: boolean; busy: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium text-center mb-2">
          Pick your mark
        </p>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button key={e} onClick={() => onEmoji(e)}
              className={`h-10 rounded-lg text-xl transition ${
                emoji === e
                  ? "bg-primary/20 border border-primary"
                  : "bg-surface-elevated border border-border hover:border-primary/50"
              }`}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={onClaim} disabled={busy}
        className="w-full rounded-full bg-primary text-primary-foreground font-medium text-sm py-3  disabled:opacity-50">
        Claim this identity →
      </motion.button>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center">
        {rerollUsed ? (
          <p className="text-[11px] text-muted-foreground italic">Re-roll used. This is your identity.</p>
        ) : (
          <button onClick={onReroll} className="text-[12px] text-muted-foreground hover:text-foreground underline">
            Not quite right? Re-roll once.
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

function ConfirmCard({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="text-center py-6 space-y-2">
      <AnimatePresence mode="wait">
        {step >= 1 && (
          <motion.p key="confirmed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-base font-medium">
            Identity confirmed.
          </motion.p>
        )}
        {step >= 2 && (
          <motion.p key="session" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground">
            The court is now in session.
          </motion.p>
        )}
      </AnimatePresence>
      {step === 0 && (<p className="text-sm text-muted-foreground">Sealing your identity…</p>)}
    </div>
  );
}

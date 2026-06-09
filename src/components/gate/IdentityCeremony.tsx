// Identity ceremony — the soft gate. The reels spin, the user verifies, the alias appears.
// Nothing in the underlying page executes until the user claims an identity here.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGateStore, type PendingAction } from "@/stores/gate";
import {
  generateAlias,
  verifyAge,
  claimAlias,
  type GeneratedAlias,
} from "@/lib/alias.functions";
import { castVerdict } from "@/lib/posts/community.functions";
import { reactToPost } from "@/lib/posts/engagement.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type Phase =
  | "auth"
  | "dob"
  | "underage"
  | "spin"
  | "reveal"
  | "confirming"
  | "done";

const EMOJI_OPTIONS = ["🦊", "🦉", "🐙", "🦋", "🌙", "⚡", "🌸", "🔥", "🎭", "👁", "🪞", "⚖️"];

// Key used to resume the ceremony after an OAuth / email-link redirect.
const RESUME_KEY = "md.gate.resume";

// Simple click tone — Web Audio, no asset needed.
function clickTone(hz: number) {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    osc.type = "triangle";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 200);
  } catch {/* silent */}
}

export function IdentityCeremony() {
  const open = useGateStore((s) => s.open);
  const pending = useGateStore((s) => s.pending);
  const close = useGateStore((s) => s.close);

  if (!open || !pending) return null;
  return <Ceremony pending={pending} onClose={close} />;
}

function Ceremony({ pending, onClose }: { pending: PendingAction; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("auth");
  const [email, setEmail] = useState("");
  const [authBusy, setAuthBusy] = useState<"idle" | "email" | "google" | "apple">("idle");
  const [dobMonth, setDobMonth] = useState<number>(1);
  const [dobYear, setDobYear] = useState<number>(new Date().getFullYear() - 25);
  const [alias, setAlias] = useState<GeneratedAlias | null>(null);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [emoji, setEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [locks, setLocks] = useState<{ n: boolean; e: boolean; c: boolean }>({ n: false, e: false, c: false });
  const [reelSpeed, setReelSpeed] = useState<"full" | "slow">("full");
  const [confirmingStep, setConfirmingStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);

  const fetchAlias = useServerFn(generateAlias);
  const submitAge = useServerFn(verifyAge);
  const claim = useServerFn(claimAlias);
  const sendVerdict = useServerFn(castVerdict);
  const sendReact = useServerFn(reactToPost);
  const qc = useQueryClient();

  // If the user already has a session (e.g. they returned from OAuth and the
  // gate was re-opened by the resume effect), skip straight to DOB.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
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
      .catch(() => {/* fall through; will retry on spin */});
  }, [fetchAlias, pending.context?.category, pending.context?.relationshipType]);

  // ── Replay pending action after claim ─────────────────────────
  const replay = async (action: PendingAction) => {
    try {
      if (action.type === "vote" && action.entityId && action.verdictKind) {
        await sendVerdict({ data: { postId: action.entityId, kind: action.verdictKind as never } });
      } else if (action.type === "relate" && action.entityId) {
        await sendReact({ data: { postId: action.entityId, kind: "been_there" } });
      }
      qc.invalidateQueries();
    } catch {/* silent — user is signed in regardless */}
  };

  // ── Stash pending action so we can resume after an OAuth / email redirect.
  const stashPending = () => {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify(pending));
    } catch {/* ignore */}
  };

  // ── Email magic link
  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy !== "idle" || !email.includes("@")) return;
    setAuthBusy("email");
    stashPending();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      toast.success("Check your inbox — tap the link to continue.");
      setAuthBusy("idle");
    } catch {
      toast.error("Couldn't send the link. Try again.");
      sessionStorage.removeItem(RESUME_KEY);
      setAuthBusy("idle");
    }
  };

  // ── OAuth (Google / Apple)
  const onOauth = async (provider: "google" | "apple") => {
    if (authBusy !== "idle") return;
    setAuthBusy(provider);
    stashPending();
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + window.location.pathname,
      });
      if (result.error) {
        toast.error("Sign-in failed.");
        sessionStorage.removeItem(RESUME_KEY);
        setAuthBusy("idle");
      }
      // On redirect, the browser leaves — state doesn't matter.
    } catch {
      toast.error("Sign-in failed.");
      sessionStorage.removeItem(RESUME_KEY);
      setAuthBusy("idle");
    }
  };



  // ── DOB submit
  const onAgeSubmit = async () => {
    const dob = `${dobYear}-${String(dobMonth).padStart(2, "0")}-15`;
    setBusy(true);
    try {
      const res = await submitAge({ data: { dob } });
      if (!res.ageOk) {
        setPhase("underage");
        return;
      }
      setPhase("spin");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  // ── Spin sequence: 800ms full speed, then lock left/middle/right
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
    setReelSpeed("full");
    setLocks({ n: false, e: false, c: false });

    const t1 = window.setTimeout(() => {
      setLocks((l) => ({ ...l, n: true }));
      clickTone(440);
    }, 2000);
    const t2 = window.setTimeout(() => {
      setLocks((l) => ({ ...l, e: true }));
      clickTone(460);
    }, 2200);
    const t3 = window.setTimeout(() => {
      setLocks((l) => ({ ...l, c: true }));
      clickTone(480);
    }, 2400);
    const t4 = window.setTimeout(() => setPhase("reveal"), 3200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
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
      await replay(pending);
      setPhase("done");
      // Slide away.
      setTimeout(() => onClose(), 450);
    } catch {
      setPhase("reveal");
    } finally {
      setBusy(false);
    }
  };

  // ── Underage hard block — full-screen, no retry, no navigation
  if (phase === "underage") {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-5xl">⚖️</p>
          <p className="text-xl font-bold text-white">
            Shutap is for adults 18 and older.
          </p>
          <p className="text-sm text-white/70">
            Come back when you're ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      {/* Backdrop — blurs through CSS on the page itself, not here */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/70 backdrop-blur-md pointer-events-auto"
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-md bg-card border-t border-x border-border rounded-t-3xl shadow-2xl pointer-events-auto overflow-hidden"
      >
        <BenchLine phase={phase} />

        <SlotMachine
          alias={alias}
          locks={locks}
          speed={reelSpeed}
          phase={phase}
        />

        <AliasLine phase={phase} alias={alias} locks={locks} />

        <div className="p-5 pt-2 space-y-3">
          {phase === "auth" && (
            <AuthCard
              email={email}
              onEmailChange={setEmail}
              onEmailSubmit={onEmail}
              onOauth={onOauth}
              busy={authBusy}
            />
          )}



          {phase === "dob" && (
            <DobCard
              month={dobMonth}
              year={dobYear}
              onMonth={setDobMonth}
              onYear={setDobYear}
              onSubmit={onAgeSubmit}
              busy={busy}
            />
          )}

          {phase === "reveal" && (
            <RevealCard
              emoji={emoji}
              onEmoji={setEmoji}
              onClaim={onClaim}
              onReroll={onReroll}
              rerollUsed={rerollUsed}
              busy={busy}
            />
          )}

          {phase === "confirming" && (
            <ConfirmCard step={confirmingStep} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Bench line at the top of the ceremony surface

function BenchLine({ phase }: { phase: Phase }) {
  const text =
    phase === "auth"
      ? "The court is assigning your identity."
      : phase === "dob"
        ? "The court asks one last thing."
        : phase === "spin"
          ? "Hold. The reels are deciding."
          : phase === "reveal"
            ? "The court has spoken."
            : phase === "confirming"
              ? ""
              : "";
  if (!text) return <div className="h-6" />;
  return (
    <p className="px-5 pt-4 pb-1 text-center text-[12px] uppercase tracking-wider text-muted-foreground font-semibold">
      {text}
    </p>
  );
}

// ── Slot machine reels

function SlotMachine({
  alias,
  locks,
  speed,
  phase,
}: {
  alias: GeneratedAlias | null;
  locks: { n: boolean; e: boolean; c: boolean };
  speed: "full" | "slow";
  phase: Phase;
}) {
  const pools = alias?.reelPools ?? { nationality: ["…"], emotion: ["…"], creature: ["…"] };
  const dimmed = phase === "phone" || phase === "otp" || phase === "dob";
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
  pool,
  locked,
  value,
  speed,
}: {
  pool: string[];
  locked: boolean;
  value: string;
  speed: "full" | "slow";
}) {
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
      className={`h-14 rounded-xl flex items-center justify-center text-center px-2 font-bold text-[13px] sm:text-sm leading-tight ${
        locked
          ? "bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/50 text-foreground"
          : "bg-background border border-border text-muted-foreground"
      }`}
    >
      <span className="truncate">{display}</span>
    </motion.div>
  );
}

function AliasLine({
  phase,
  alias,
  locks,
}: {
  phase: Phase;
  alias: GeneratedAlias | null;
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
    <p className="px-5 pt-3 text-center text-base sm:text-lg font-semibold">
      {text}
    </p>
  );
}

// ── Phone card

function PhoneCard({
  countryCode,
  onCountryChange,
  phoneNumber,
  onPhoneChange,
  onSubmit,
}: {
  countryCode: string;
  onCountryChange: (v: string) => void;
  phoneNumber: string;
  onPhoneChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3"
    >
      <p className="text-sm font-semibold">To claim your identity, verify your number.</p>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          className="rounded-lg bg-background border border-border px-2 py-2 text-sm"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          value={phoneNumber}
          onChange={(e) => onPhoneChange(e.target.value.replace(/[^0-9 \-]/g, ""))}
          placeholder="555 123 4567"
          maxLength={16}
          className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={phoneNumber.replace(/[^0-9]/g, "").length < 6}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm py-2.5 disabled:opacity-50"
      >
        Send code →
      </button>
    </form>
  );
}

// ── OTP card

function OtpCard({
  value,
  onChange,
  onSubmit,
  error,
  busy,
  phone,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (codeValue?: string) => void;
  error: string | null;
  busy: boolean;
  phone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <p className="text-sm font-semibold">
        Code sent to <span className="text-muted-foreground font-normal">{phone}</span>
      </p>
      <p className="text-[11px] text-muted-foreground">
        Demo mode — any 6 digits will work.
      </p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
          onChange(v);
          if (v.length === 6) onSubmit(v);
        }}
        placeholder="• • • • • •"
        className="w-full text-center tracking-[0.5em] text-lg font-bold rounded-lg bg-background border border-border px-3 py-3"
        autoFocus
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={() => onSubmit()}
        disabled={value.length !== 6 || busy}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm py-2.5 disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify →"}
      </button>
    </div>
  );
}

// ── DOB card

function DobCard({
  month,
  year,
  onMonth,
  onYear,
  onSubmit,
  busy,
}: {
  month: number;
  year: number;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <p className="text-sm font-semibold">When were you born?</p>
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => onMonth(parseInt(e.target.value, 10))}
          className="flex-1 rounded-lg bg-background border border-border px-2 py-2 text-sm"
        >
          {months.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => onYear(parseInt(e.target.value, 10))}
          className="w-32 rounded-lg bg-background border border-border px-2 py-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm py-2.5 disabled:opacity-50"
      >
        {busy ? "Checking…" : "I'm 18 or older →"}
      </button>
    </div>
  );
}

// ── Reveal card

function RevealCard({
  emoji,
  onEmoji,
  onClaim,
  onReroll,
  rerollUsed,
  busy,
}: {
  emoji: string;
  onEmoji: (v: string) => void;
  onClaim: () => void;
  onReroll: () => void;
  rerollUsed: boolean;
  busy: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold text-center mb-2">
          Pick your mark
        </p>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onEmoji(e)}
              className={`h-10 rounded-lg text-xl transition ${
                emoji === e
                  ? "bg-primary/20 border border-primary"
                  : "bg-surface-elevated border border-border hover:border-primary/50"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={onClaim}
        disabled={busy}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm py-3 shadow-lg disabled:opacity-50"
      >
        Claim this identity →
      </motion.button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center"
      >
        {rerollUsed ? (
          <p className="text-[11px] text-muted-foreground italic">
            Re-roll used. This is your identity.
          </p>
        ) : (
          <button
            onClick={onReroll}
            className="text-[12px] text-muted-foreground hover:text-foreground underline"
          >
            Not quite right? Re-roll once.
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Confirming card (post-claim sequence)

function ConfirmCard({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="text-center py-6 space-y-2">
      <AnimatePresence mode="wait">
        {step >= 1 && (
          <motion.p
            key="confirmed"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-base font-semibold"
          >
            Identity confirmed.
          </motion.p>
        )}
        {step >= 2 && (
          <motion.p
            key="session"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground"
          >
            The court is now in session.
          </motion.p>
        )}
      </AnimatePresence>
      {step === 0 && (
        <p className="text-sm text-muted-foreground">Sealing your identity…</p>
      )}
    </div>
  );
}

// ☕ Judge My Relationship™ — high-conversion viral flow.
// 7–10 screens, one question per screen, mostly tap+slider, AI-style reactions.
// Persists to existing scan_results so scoring + result page keep working.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  startScan,
  saveAnswersBatch,
  completeScan,
} from "@/lib/scan.functions";
import { detectBrowserLocale, isLocale } from "@/lib/i18n";
import type { AnswerMap } from "@/lib/scan/types";

export const Route = createFileRoute("/_authenticated/scan/start")({
  component: QuickScan,
  head: () => ({
    meta: [
      { title: "👀 Judge My Relationship™ — 90 seconds of truth" },
      {
        name: "description",
        content:
          "Tap, slide, spill. We score the chaos in your relationship in under 90 seconds.",
      },
    ],
  }),
});

/* ───────────────────────── types & data ───────────────────────── */

type RelKind = "married" | "dating" | "situationship" | "breakup" | "family";
type IssueId =
  | "trust"
  | "phone"
  | "comm"
  | "distance"
  | "money"
  | "family"
  | "cheating"
  | "intimacy"
  | "idk";
type ReceiptKind = "texts" | "media" | "vibes";
type LoveBonus = "love" | "kids" | "habit" | "hope" | "chemistry" | "money" | "idk";

interface State {
  rel?: RelKind;
  chaos: number; // 0..100
  issues: IssueId[];
  receipts?: ReceiptKind;
  teaText: string;
  love?: LoveBonus;
}

const REL_OPTIONS: { id: RelKind; emoji: string; label: string; reaction: string }[] = [
  { id: "married",      emoji: "💍", label: "married",        reaction: "Oh we're in the trenches. Buckle up." },
  { id: "dating",       emoji: "💕", label: "dating",         reaction: "Cute. For now." },
  { id: "situationship",emoji: "🤡", label: "situationship",  reaction: "Ah. The Olympic sport of confusion." },
  { id: "breakup",      emoji: "💔", label: "breakup-ish",    reaction: "Mm. We're going to need wine for this." },
  { id: "family",       emoji: "👨‍👩‍👧", label: "family drama", reaction: "Family. The original group chat from hell." },
];

const CHAOS_STEPS = [
  { v: 0,   emoji: "😌", label: "perfectly fine",       react: "Okay overachiever. Be honest though." },
  { v: 33,  emoji: "🤨", label: "weird vibes",          react: "Mm. Weird vibes are never wrong." },
  { v: 66,  emoji: "😭", label: "emotional Olympics",   react: "Okay wow. We are not in peaceful territory." },
  { v: 100, emoji: "🍿", label: "Netflix documentary",  react: "Bestie. This needs three episodes minimum." },
];

const ISSUE_OPTIONS: { id: IssueId; label: string; emoji: string }[] = [
  { id: "trust",     emoji: "🕵️", label: "trust issues" },
  { id: "phone",     emoji: "📱", label: "weird phone behavior" },
  { id: "comm",      emoji: "🗣️", label: "communication disaster" },
  { id: "distance",  emoji: "🧊", label: "emotional distance" },
  { id: "money",     emoji: "💸", label: "money chaos" },
  { id: "family",    emoji: "👵", label: "family drama" },
  { id: "cheating",  emoji: "🚩", label: "cheating vibes" },
  { id: "intimacy",  emoji: "🥶", label: "intimacy issues" },
  { id: "idk",       emoji: "🤷", label: "honestly… I don't know" },
];

const RECEIPT_OPTIONS: { id: ReceiptKind; emoji: string; label: string; react: string }[] = [
  { id: "texts", emoji: "📱", label: "texts / screenshots", react: "The receipts are receipting. Iconic." },
  { id: "media", emoji: "🎥", label: "videos / photos",     react: "Cinema. Absolute cinema." },
  { id: "vibes", emoji: "😬", label: "just vibes",          react: "Respectfully… the group chat would ask for proof." },
];

const LOVE_OPTIONS: { id: LoveBonus; emoji: string; label: string }[] = [
  { id: "love",      emoji: "❤️", label: "I still love them" },
  { id: "kids",      emoji: "👶", label: "kids / family" },
  { id: "habit",     emoji: "😵", label: "habit" },
  { id: "hope",      emoji: "🤷", label: "hope" },
  { id: "chemistry", emoji: "🔥", label: "chemistry" },
  { id: "money",     emoji: "💸", label: "finances" },
  { id: "idk",       emoji: "🙃", label: "honestly no idea" },
];

const LOADING_LINES = [
  "Checking emotional damage…",
  "Reviewing suspicious behavior…",
  "Calculating chaos level…",
  "Searching for green flags…",
  "Detecting plot twists…",
  "Consulting the group chat…",
];

/* ───────────────── mapping → existing question bank ───────────────── */

function buildAnswers(s: State): AnswerMap {
  const a: AnswerMap = {};
  // relationship type → marriage_status
  if (s.rel) {
    const map: Record<RelKind, string> = {
      married: "married",
      dating: "dating",
      situationship: "dating",
      breakup: "separated",
      family: "married",
    };
    a.marriage_status = map[s.rel];
    if (s.rel === "family") a.has_kids = "yes_adult";
  }
  // chaos slider → crying_frequency (and loneliness echo)
  a.crying_frequency = s.chaos;
  a.loneliness = Math.max(0, s.chaos - 10);

  // issues multi → seed multiple bank answers
  const has = (id: IssueId) => s.issues.includes(id);
  if (has("trust"))    a.trust_level = 20;       // low trust = high score
  if (has("phone"))    a.secret_phone = "phone";
  if (has("comm"))     a.conflict_style = "silent";
  if (has("distance")) { a.emotional_safety = 25; a.loneliness = Math.max(70, a.loneliness as number); }
  if (has("money"))    { a.money_fights = 75; a.hidden_debt = "small"; }
  if (has("family"))   { a.in_laws = 80; a.family_interference = ["mil"]; }
  if (has("cheating")) a.cheating = "suspected";
  if (has("intimacy")) a.affection = 15;

  // love bonus → would_choose_again
  if (s.love) {
    const m: Record<LoveBonus, string> = {
      love: "yes",
      chemistry: "yes",
      kids: "probably",
      hope: "probably",
      habit: "idk",
      money: "idk",
      idk: "idk",
    };
    a.would_choose_again = m[s.love];
  }

  // tea text → biggest_plot_twist
  if (s.teaText.trim()) a.biggest_plot_twist = s.teaText.trim().slice(0, 1000);

  return a;
}

/* ───────────────── personalized step-5 questions ───────────────── */

function teaPrompt(s: State): { headline: string; placeholder: string } {
  const top = s.issues[0];
  if (top === "trust" || top === "phone") {
    return { headline: "When did your gut start feeling weird? 👀", placeholder: "be specific. we love specifics." };
  }
  if (top === "money") {
    return { headline: "Are we talking bad budgeting… or secret spending? 💸", placeholder: "what was the moment you noticed?" };
  }
  if (top === "family") {
    return { headline: "How involved is the mother-in-law situation? 👵", placeholder: "the more chaotic the better." };
  }
  if (top === "cheating") {
    return { headline: "Okay. What's the moment you can't unsee? 🚩", placeholder: "we'll never repeat this. (anonymous)" };
  }
  if (top === "comm") {
    return { headline: "What's the dumbest thing you fought about last? 🗣️", placeholder: "we know it was something stupid." };
  }
  if (top === "distance" || top === "intimacy") {
    return { headline: "When did the texture of the relationship change? 🧊", placeholder: "first thing that comes to mind." };
  }
  return { headline: "Okay spill — what's the one thing on your mind right now? ☕", placeholder: "no edit. just spill." };
}

/* ───────────────── tiny UI atoms ───────────────── */

function ChipButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 rounded-2xl border text-base font-medium transition ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface-elevated hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function Reaction({ children, show }: { children: React.ReactNode; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-4 mx-auto max-w-sm text-center text-sm italic text-muted-foreground"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center pt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < step ? "w-6 bg-primary" : i === step ? "w-8 bg-accent" : "w-3 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

/* ───────────────── main component ───────────────── */

const TOTAL_STEPS = 7; // user-facing screens before loading/reveal

function QuickScan() {
  const navigate = useNavigate();
  const startFn = useServerFn(startScan);
  const saveFn = useServerFn(saveAnswersBatch);
  const completeFn = useServerFn(completeScan);

  const [scanId, setScanId] = useState<string | null>(null);
  const startedRef = useRef(false);
  const [step, setStep] = useState(0);
  const [reactKey, setReactKey] = useState<string | null>(null);
  const [s, setS] = useState<State>({ chaos: 50, issues: [], teaText: "" });
  const [submitting, setSubmitting] = useState(false);

  // Kick off scan creation
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
        const locale = isLocale(stored) ? stored : detectBrowserLocale();
        const r = await startFn({ data: { locale } });
        setScanId(r.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start");
      }
    })();
  }, [startFn]);

  // Advance with a tiny pause to show the reaction
  const advance = (key?: string, delay = 800) => {
    if (key) setReactKey(key);
    window.setTimeout(() => {
      setReactKey(null);
      setStep((x) => x + 1);
    }, delay);
  };

  const tea = useMemo(() => teaPrompt(s), [s]);

  // Finalize
  const finalize = async () => {
    if (!scanId || submitting) return;
    setSubmitting(true);
    try {
      const answers = buildAnswers(s);
      await saveFn({ data: { scanId, answers } });
      const final = await completeFn({ data: { scanId } });
      navigate({
        to: "/scan/result/$scanId",
        params: { scanId: final.id },
        replace: true,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finish");
      setSubmitting(false);
    }
  };

  // Auto-finalize when we hit the loading step
  useEffect(() => {
    if (step === TOTAL_STEPS) {
      // suspense window also kicks off finalize
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <Link to="/scan" className="text-sm text-muted-foreground">← exit</Link>
        <div className="text-xs font-medium tracking-wider text-accent uppercase">Judge My Relationship™</div>
        <span className="w-12" />
      </header>
      <ProgressDots step={Math.min(step, TOTAL_STEPS)} total={TOTAL_STEPS} />

      <main className="flex-1 px-5 pt-6 pb-32 mx-auto w-full max-w-md">
        <AnimatePresence mode="wait">
          {/* STEP 0 — relationship type */}
          {step === 0 && (
            <motion.section
              key="s0"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <h1 className="text-3xl font-medium leading-tight text-balance">
                👀 Okay wait…
              </h1>
              <p className="mt-1 text-2xl font-medium text-muted-foreground">
                what kind of mess are we talking about?
              </p>
              <div className="mt-6 space-y-2.5">
                {REL_OPTIONS.map((o) => (
                  <ChipButton
                    key={o.id}
                    active={s.rel === o.id}
                    onClick={() => {
                      setS((p) => ({ ...p, rel: o.id }));
                      advance(o.reaction, 900);
                    }}
                  >
                    <span className="mr-2 text-xl">{o.emoji}</span>
                    {o.label}
                  </ChipButton>
                ))}
              </div>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
            </motion.section>
          )}

          {/* STEP 1 — chaos slider */}
          {step === 1 && (
            <motion.section
              key="s1"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <h1 className="text-3xl font-medium leading-tight text-balance">
                Be honest…
              </h1>
              <p className="mt-1 text-xl text-muted-foreground">
                how dramatic are things lately?
              </p>

              <div className="mt-10 text-center">
                <div className="text-7xl mb-2">
                  {CHAOS_STEPS.reduce((acc, c) => (s.chaos >= c.v ? c : acc), CHAOS_STEPS[0]).emoji}
                </div>
                <div className="text-base font-medium">
                  {CHAOS_STEPS.reduce((acc, c) => (s.chaos >= c.v ? c : acc), CHAOS_STEPS[0]).label}
                </div>
              </div>

              <input
                type="range" min={0} max={100}
                value={s.chaos}
                onChange={(e) => setS((p) => ({ ...p, chaos: parseInt(e.target.value, 10) }))}
                className="mt-8 w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>😌 fine</span><span>🍿 cinema</span>
              </div>

              <button
                onClick={() => {
                  const tier = CHAOS_STEPS.reduce(
                    (acc, c) => (s.chaos >= c.v ? c : acc),
                    CHAOS_STEPS[0],
                  );
                  advance(tier.react, 800);
                }}
                className="mt-10 w-full px-6 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg "
              >
                that's the vibe →
              </button>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
            </motion.section>
          )}

          {/* STEP 2 — issues multi */}
          {step === 2 && (
            <motion.section
              key="s2"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <h1 className="text-3xl font-medium leading-tight">
                🚩 what's the main issue?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">pick up to 3. we won't tell.</p>
              <div className="mt-5 grid grid-cols-1 gap-2.5">
                {ISSUE_OPTIONS.map((o) => {
                  const active = s.issues.includes(o.id);
                  const atCap = s.issues.length >= 3 && !active;
                  return (
                    <button
                      key={o.id}
                      disabled={atCap}
                      onClick={() => {
                        setS((p) => ({
                          ...p,
                          issues: active
                            ? p.issues.filter((x) => x !== o.id)
                            : o.id === "idk"
                              ? ["idk"]
                              : [...p.issues.filter((x) => x !== "idk"), o.id].slice(0, 3),
                        }));
                      }}
                      className={`text-left px-4 py-3.5 rounded-2xl border transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : atCap
                            ? "border-border bg-surface-elevated opacity-40"
                            : "border-border bg-surface-elevated hover:border-primary/50"
                      }`}
                    >
                      <span className="mr-2 text-lg">{o.emoji}</span>{o.label}
                      {active && <span className="float-right text-primary">✓</span>}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={s.issues.length === 0}
                onClick={() => advance("noted. continuing the investigation 🔍", 700)}
                className="mt-6 w-full px-6 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg  disabled:opacity-40"
              >
                continue →
              </button>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
            </motion.section>
          )}

          {/* STEP 3 — receipts */}
          {step === 3 && (
            <motion.section
              key="s3"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <h1 className="text-3xl font-medium leading-tight">okay be honest 👀</h1>
              <p className="mt-1 text-xl text-muted-foreground">do you have receipts?</p>
              <div className="mt-6 space-y-2.5">
                {RECEIPT_OPTIONS.map((o) => (
                  <ChipButton
                    key={o.id}
                    active={s.receipts === o.id}
                    onClick={() => {
                      setS((p) => ({ ...p, receipts: o.id }));
                      advance(o.react, 1000);
                    }}
                  >
                    <span className="mr-2 text-xl">{o.emoji}</span>{o.label}
                  </ChipButton>
                ))}
              </div>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
              <p className="mt-4 text-xs text-muted-foreground text-center">
                (you can upload media when we turn this into a post)
              </p>
            </motion.section>
          )}

          {/* STEP 4 — the one tea question (personalized) */}
          {step === 4 && (
            <motion.section
              key="s4"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <div className="text-xs text-muted-foreground mb-2">one real question. then we go.</div>
              <h1 className="text-3xl font-medium leading-tight text-balance">
                {tea.headline}
              </h1>
              <textarea
                value={s.teaText}
                onChange={(e) => setS((p) => ({ ...p, teaText: e.target.value.slice(0, 600) }))}
                placeholder={tea.placeholder}
                rows={5}
                className="mt-5 w-full rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-base focus:outline-none focus:border-primary"
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{s.teaText.length}/600</div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => advance("noted ✍️", 500)}
                  className="flex-1 px-4 py-3 rounded-full bg-surface-elevated border border-border text-sm"
                >
                  skip
                </button>
                <button
                  onClick={() => advance("ok this is juicy 🍵", 600)}
                  className="flex-[2] px-6 py-3.5 rounded-full bg-primary text-primary-foreground font-medium "
                >
                  spill →
                </button>
              </div>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
            </motion.section>
          )}

          {/* STEP 5 — love bonus */}
          {step === 5 && (
            <motion.section
              key="s5"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <h1 className="text-3xl font-medium leading-tight text-balance">
                okay but be honest…
              </h1>
              <p className="mt-1 text-xl text-muted-foreground">
                why are you still here? 😭
              </p>
              <div className="mt-6 space-y-2.5">
                {LOVE_OPTIONS.map((o) => (
                  <ChipButton
                    key={o.id}
                    active={s.love === o.id}
                    onClick={() => {
                      setS((p) => ({ ...p, love: o.id }));
                      advance(
                        o.id === "love" ? "okay that's beautiful actually 🥺" :
                        o.id === "habit" ? "respectfully… we need to talk 😅" :
                        o.id === "idk" ? "valid. also concerning. continuing." :
                        "noted. the group chat agrees.",
                        900,
                      );
                    }}
                  >
                    <span className="mr-2 text-xl">{o.emoji}</span>{o.label}
                  </ChipButton>
                ))}
              </div>
              <Reaction show={!!reactKey}>{reactKey}</Reaction>
            </motion.section>
          )}

          {/* STEP 6 — review + go */}
          {step === 6 && (
            <motion.section
              key="s6"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="text-center"
            >
              <div className="text-6xl">🧮</div>
              <h1 className="mt-4 text-3xl font-medium leading-tight">
                that's it. 90 seconds. iconic.
              </h1>
              <p className="mt-2 text-muted-foreground">
                ready to see your Relationship Chaos Score™?
              </p>
              <button
                onClick={() => setStep(TOTAL_STEPS)}
                className="mt-8 w-full px-6 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg "
              >
                🚨 calculate the chaos →
              </button>
              <p className="mt-3 text-xs text-muted-foreground">anonymous. always.</p>
            </motion.section>
          )}

          {/* STEP 7 — loading / suspense */}
          {step >= TOTAL_STEPS && (
            <LoadingReveal key="loading" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function LoadingReveal() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % LOADING_LINES.length), 700);
    return () => window.clearInterval(id);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center"
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="text-7xl mb-6"
      >
        🔮
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-lg font-medium text-muted-foreground"
        >
          {LOADING_LINES[i]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

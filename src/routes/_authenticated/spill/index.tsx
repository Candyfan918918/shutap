// Spill composer — pick type + voice, drop the dump, submit. Visual: shutap_spill_flow.html
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createTeaDraft } from "@/lib/spill.functions";
import { detectBrowserLocale, isLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/spill/")({
  component: SpillLanding,
  head: () => ({
    meta: [
      { title: "Spill — Shutap" },
      { name: "description", content: "Tell the court what happened. One question at a time. Your words, your story." },
    ],
  }),
});

const RULES = [
  "No names. No identifying details.",
  "The more you give, the sharper the verdict.",
  "You review and approve before anything posts.",
];

type CaseType = { id: string; label: string; hint: string };
const CASE_TYPES: CaseType[] = [
  { id: "marriage", label: "Marriage", hint: "rings, in-laws, vows tested" },
  { id: "dating", label: "Dating", hint: "talking, situationship, dating apps" },
  { id: "breakup", label: "Breakup", hint: "the ending, the aftermath" },
  { id: "family", label: "Family", hint: "parents, siblings, the chosen ones" },
  { id: "friendship", label: "Friendship", hint: "the group chat, the fallout" },
  { id: "work", label: "Work", hint: "boss, colleagues, the office politics" },
];

type Voice = { id: "honest" | "funny" | "petty"; label: string; hint: string };
const VOICES: Voice[] = [
  { id: "honest", label: "Honest", hint: "straight, no chaser" },
  { id: "funny", label: "Funny", hint: "find the joke in the wreckage" },
  { id: "petty", label: "Petty", hint: "let them have it" },
];

const PLACEHOLDERS = [
  "He suddenly changed his password…",
  "My mother-in-law moved in and rearranged…",
  "I found something weird in his car…",
  "We were perfect until the wedding ended…",
  "She said she was working late. She wasn't.",
];

const DRAFT_KEY = "shutap.spill.draft.v1";

function formatSavedAt(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return "saved just now";
  if (diff < 60_000) return `saved ${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `saved ${Math.floor(diff / 60_000)}m ago`;
  return `saved ${Math.floor(diff / 3_600_000)}h ago`;
}

function SpillLanding() {
  const navigate = useNavigate();
  const create = useServerFn(createTeaDraft);
  const [caseType, setCaseType] = useState<string | null>(null);
  const [voice, setVoice] = useState<Voice["id"]>("honest");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        text?: string;
        caseType?: string | null;
        voice?: Voice["id"];
        savedAt?: number;
      };
      if (d.text) setText(d.text);
      if (d.caseType !== undefined) setCaseType(d.caseType);
      if (d.voice) setVoice(d.voice);
      if (d.savedAt) setSavedAt(d.savedAt);
      if (d.text && d.text.trim()) setRestored(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Debounced autosave
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!text.trim() && !caseType) {
          localStorage.removeItem(DRAFT_KEY);
          setSavedAt(null);
          return;
        }
        const now = Date.now();
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ text, caseType, voice, savedAt: now }),
        );
        setSavedAt(now);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [text, caseType, voice]);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 360) + "px";
  }, [text]);

  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const progress = Math.min(100, 8 + Math.min(80, wordCount * 1.5) + (caseType ? 8 : 0));

  const clearDraft = () => {
    setText("");
    setCaseType(null);
    setVoice("honest");
    setRestored(false);
    setSavedAt(null);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const onSpill = async () => {
    if (submitting) return;
    if (!text.trim()) {
      toast.message("Drop something — even one line.");
      return;
    }
    setSubmitting(true);
    try {
      const locale = (() => {
        const s = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
        return isLocale(s) ? s : detectBrowserLocale();
      })();
      const header = [
        caseType ? `[Type: ${caseType}]` : null,
        `[Voice: ${voice}]`,
      ]
        .filter(Boolean)
        .join(" ");
      const rawDump = `${header}\n\n${text.trim()}`;
      const { draftId } = await create({
        data: { rawDump, attachments: [], locale },
      });
      navigate({ to: "/spill/$draftId/chat", params: { draftId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the case. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">✕</Link>
          <div className="flex-1 text-center text-sm font-medium">Spill</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-surface-3 bg-c-surface">
        {/* HERO */}
        <section className="hero-dark spill-hero">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hero-dark__tag">The co-pilot is listening</div>
          <h1 className="spill-hero__q">
            Tell the court<br />what happened.
          </h1>
          <p className="hero-dark__sub">
            One question at a time. Your words, your story — The Bench just draws it out.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {RULES.map((r) => (
              <div key={r} className="flex items-center gap-2 text-[11px] text-c-ink-3">
                <span className="w-[5px] h-[5px] rounded-full bg-c-pink flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </section>

        {/* PROGRESS RAIL */}
        <div className="px-3.5 pt-3 pb-2.5 bg-c-surface">
          <div className="h-1 rounded-full bg-c-surface-3 overflow-hidden">
            <div
              className="h-full bg-c-pink rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-c-text-3">
            <span className={progress < 25 ? "text-c-pink font-medium" : ""}>Opening</span>
            <span className={progress >= 25 && progress < 55 ? "text-c-pink font-medium" : ""}>Context</span>
            <span className={progress >= 55 && progress < 80 ? "text-c-pink font-medium" : ""}>The incident</span>
            <span className={progress >= 80 && progress < 95 ? "text-c-pink font-medium" : ""}>After</span>
            <span className={progress >= 95 ? "text-c-pink font-medium" : ""}>Ready</span>
          </div>
        </div>

        {/* TYPE PRESETS */}
        <section className="px-3.5 pt-4">
          <div className="text-[11px] uppercase tracking-wider text-c-text-3 font-medium mb-2">
            What kind of case?
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CASE_TYPES.map((t) => {
              const active = caseType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCaseType(active ? null : t.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition ${
                    active
                      ? "bg-c-pink text-white border-c-pink"
                      : "bg-c-surface-2 text-c-text-2 border-c-surface-3 hover:border-c-pink/40"
                  }`}
                  title={t.hint}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* VOICE PRESETS */}
        <section className="px-3.5 pt-4">
          <div className="text-[11px] uppercase tracking-wider text-c-text-3 font-medium mb-2">
            Your voice
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map((v) => {
              const active = voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(v.id)}
                  className={`text-left px-3 py-2.5 rounded-2xl border transition ${
                    active
                      ? "bg-c-ink text-c-surface border-c-ink"
                      : "bg-c-surface-2 text-c-text-2 border-c-surface-3 hover:border-c-ink/40"
                  }`}
                >
                  <div className="text-[13px] font-medium">{v.label}</div>
                  <div className={`text-[10px] mt-0.5 ${active ? "text-c-surface/70" : "text-c-text-3"}`}>
                    {v.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* CHAT OPENER */}
        <div className="spill-chat">
          <div className="flex gap-2 items-end">
            <div className="brow-av">⚖️</div>
            <div className="brow-bubble max-w-[80%]">
              What happened? Start wherever feels right — <b className="text-c-ink font-medium">don't edit yourself.</b>
            </div>
          </div>
        </div>

        {/* COMPOSER */}
        <div className="mt-2 border-t border-c-surface-3 bg-c-surface px-3.5 pt-3 pb-4">
          <div className="bg-white border border-c-surface-3 rounded-2xl px-3.5 py-3 focus-within:border-c-pink/60 transition">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDERS[phIdx]}
              className="w-full min-h-[80px] resize-none bg-transparent text-[14px] leading-relaxed text-c-ink placeholder:text-c-text-3 placeholder:italic focus:outline-none"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-[11px] text-c-text-3">{wordCount} words</div>
              <button
                type="button"
                onClick={onSpill}
                disabled={submitting || !text.trim()}
                className="w-9 h-9 rounded-full bg-c-pink text-white grid place-items-center disabled:opacity-40 transition"
                aria-label="Submit"
              >
                {submitting ? "…" : "↑"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={onSpill}
              disabled={submitting || !text.trim()}
              className="py-3 text-center rounded-2xl bg-c-pink text-white text-sm font-medium disabled:opacity-40"
            >
              {submitting ? "Opening case…" : "Open the case →"}
            </button>
            <Link
              to="/spill/start"
              search={{ voice: 1 }}
              className="py-3 text-center rounded-2xl bg-c-surface-2 border border-c-surface-3 text-sm font-medium text-c-text-2"
            >
              🎙 Tell it out loud
            </Link>
          </div>
          <p className="text-center text-[11px] text-c-text-3 pt-2.5">
            🔒 Anonymous. The court doesn't need your name.
          </p>
        </div>
      </main>
    </div>
  );
}

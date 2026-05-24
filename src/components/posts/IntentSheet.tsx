// IntentSheet: shown after publish ("what do you actually need right now?").
// Records an intent + computes an internal lead score. If the user picks
// legal / next-step / documentation help, a permission-based contact form
// can be opened (strictly opt-in, never hard-sold).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  recordIntent,
  submitLeadContact,
  getMyLatestIntent,
  type IntentKind,
} from "@/lib/leads.functions";

const INTENT_CARDS: Array<{
  id: IntentKind;
  emoji: string;
  label: string;
  sub: string;
  followUp: boolean; // shows optional contact form afterwards
}> = [
  { id: "reactions",     emoji: "☕", label: "Just reactions",     sub: "I want the internet's take.",           followUp: false },
  { id: "support",       emoji: "🫂", label: "Emotional support",  sub: "I need to feel less alone in this.",    followUp: false },
  { id: "documentation", emoji: "📝", label: "Documentation help", sub: "Help me write this down properly.",     followUp: true  },
  { id: "legal",         emoji: "⚖️", label: "Maybe legal help",   sub: "Quietly want to know my options.",      followUp: true  },
  { id: "next_steps",    emoji: "💔", label: "Next-step help",     sub: "I don't know what to do next.",         followUp: true  },
];

const HELP_LABEL: Record<IntentKind, string> = {
  reactions: "Just reactions",
  support: "Emotional support",
  documentation: "Documentation help",
  legal: "Legal guidance",
  next_steps: "Next-step help",
};

export function IntentSheet({
  postId,
  onDone,
}: {
  postId: string;
  onDone?: () => void;
}) {
  const record = useServerFn(recordIntent);
  const getLatest = useServerFn(getMyLatestIntent);
  const submitContact = useServerFn(submitLeadContact);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<IntentKind | null>(null);
  const [urgency, setUrgency] = useState(3);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "followUp" | "thanks">("pick");
  const [submitting, setSubmitting] = useState(false);

  // contact form
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await getLatest({ data: { postId } });
        if (cancelled) return;
        if (!existing) setOpen(true);
      } catch {
        if (!cancelled) setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, getLatest]);

  if (!open) return null;

  const onPick = async (kind: IntentKind) => {
    if (submitting) return;
    setPicked(kind);
    setSubmitting(true);
    try {
      const res = await record({
        data: { intent: kind, postId, urgency, source: "post_publish" },
      });
      setIntentId(res.id);
      const card = INTENT_CARDS.find((c) => c.id === kind)!;
      setPhase(card.followUp ? "followUp" : "thanks");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that.");
      setPicked(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !consent) return;
    if (!email.trim() && !phone.trim()) {
      toast.error("Add an email or phone — your choice.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContact({
        data: {
          intentId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          helpType: picked ?? undefined,
          consent: true,
        },
      });
      toast.success("Got it. We'll only reach out if it actually helps.");
      setPhase("thanks");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setOpen(false);
    onDone?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 backdrop-blur-sm p-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="w-full max-w-md bg-card border border-border rounded-3xl p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {phase === "pick" && (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">private check-in</div>
              <h2 className="font-black text-xl mt-1">What do you actually need right now?</h2>
              <p className="text-sm text-muted-foreground mt-1">Only you (and nobody on your feed) sees this answer.</p>

              <div className="mt-4 space-y-2">
                {INTENT_CARDS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    disabled={submitting}
                    className={`w-full text-left rounded-2xl border p-3 transition flex items-center gap-3 ${
                      picked === c.id
                        ? "bg-primary/10 border-primary"
                        : "bg-surface-elevated border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="text-2xl">{c.emoji}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{c.label}</div>
                      <div className="text-xs text-muted-foreground">{c.sub}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-xs text-muted-foreground">How urgent does it feel?</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={urgency}
                  onChange={(e) => setUrgency(Number(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>not really</span>
                  <span className="tabular-nums">{urgency}/5</span>
                  <span>like… now</span>
                </div>
              </div>

              <button onClick={close} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground py-2">
                Skip for now
              </button>
            </>
          )}

          {phase === "followUp" && picked && (
            <form onSubmit={onSubmitContact}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">optional</div>
              <h2 className="font-black text-xl mt-1">Want help figuring out next steps?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Totally optional. Nothing is shared on your post. We'll only reach out if there's something actually useful for{" "}
                <span className="text-foreground font-medium">{HELP_LABEL[picked].toLowerCase()}</span>.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={40}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  placeholder="City (optional)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={120}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I'm okay with the team contacting me about{" "}
                    <span className="text-foreground">{HELP_LABEL[picked].toLowerCase()}</span>.
                    My contact info stays private and is never shown on my profile or posts.
                  </span>
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase("thanks")}
                  className="flex-1 py-2.5 rounded-full bg-surface-elevated border border-border text-sm"
                >
                  No thanks
                </button>
                <button
                  type="submit"
                  disabled={submitting || !consent}
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Send privately"}
                </button>
              </div>
            </form>
          )}

          {phase === "thanks" && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🫶</div>
              <h2 className="font-black text-xl">Saved. Privately.</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Nobody on your feed sees this. You can change your mind any time.
              </p>
              <button
                onClick={close}
                className="mt-4 w-full py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold"
              >
                Got it
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

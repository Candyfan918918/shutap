// Full-screen interstitial shown when a publish attempt is blocked by the safety classifier.
// Never reveals the raw classifier output to the user. Tone stays warm.

import { motion } from "framer-motion";

export type BlockedReason = {
  reasons: string[];
  draftId: string | null;
  abuseRisk?: "none" | "possible" | "likely";
  selfHarmRisk?: "none" | "possible" | "likely";
};

/**
 * Parses an error thrown by `approveAndPublish` to detect a safety block.
 * Returns null when the error is not a safety block.
 */
export function parseSafetyBlock(err: unknown): BlockedReason | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const idx = msg.indexOf("SAFETY_BLOCK:");
  if (idx === -1) return null;
  const tail = msg.slice(idx + "SAFETY_BLOCK:".length).trim();
  try {
    const parsed = JSON.parse(tail) as Partial<BlockedReason>;
    return {
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      draftId: typeof parsed.draftId === "string" ? parsed.draftId : null,
      abuseRisk: parsed.abuseRisk,
      selfHarmRisk: parsed.selfHarmRisk,
    };
  } catch {
    // Older callers may have thrown a plain string after SAFETY_BLOCK:
    return { reasons: tail ? [tail] : [], draftId: null };
  }
}

type Props = {
  /** When true, renders the full-screen interstitial. */
  open: boolean;
  /** Called when the user picks "Edit my story" — should restore the composer with the draft. */
  onEdit: () => void;
  /** Optional callback for "Talk to a therapist". Defaults to a future-phase placeholder. */
  onTalkToTherapist?: () => void;
};

/**
 * Full-screen, non-dismissible (except via the three actions) interstitial.
 * Warm tone, soft cream background, no red / alarm color, no classifier copy.
 */
export function BlockedContentInterstitial({ open, onEdit, onTalkToTherapist }: Props) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4" aria-hidden>💛</div>
          <h1 className="font-serif text-2xl leading-snug text-foreground mb-3">
            We can't post this story publicly right now.
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            What you've shared deserves more than comments — it deserves real help.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              if (onTalkToTherapist) onTalkToTherapist();
              else
                window.open(
                  "https://www.psychologytoday.com/us/therapists",
                  "_blank",
                  "noopener,noreferrer",
                );
            }}
            className="w-full text-left rounded-2xl border border-border bg-card hover:bg-accent transition px-5 py-4 flex items-start gap-4"
          >
            <span className="text-2xl" aria-hidden>🛋️</span>
            <span className="flex-1">
              <span className="block font-medium text-foreground">Talk to a therapist</span>
              <span className="block text-sm text-muted-foreground mt-0.5">
                Confidential, judgment-free, real support.
              </span>
            </span>
          </button>

          <a
            href="https://988lifeline.org"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-left rounded-2xl border border-border bg-card hover:bg-accent transition px-5 py-4 flex items-start gap-4"
          >
            <span className="text-2xl" aria-hidden>📞</span>
            <span className="flex-1">
              <span className="block font-medium text-foreground">Crisis resources</span>
              <span className="block text-sm text-muted-foreground mt-0.5">
                988 Lifeline (US) · Text HOME to 741741 ·{" "}
                <span className="underline">findahelpline.com</span> (international)
              </span>
            </span>
          </a>

          <button
            type="button"
            onClick={onEdit}
            className="w-full text-left rounded-2xl border border-border bg-card hover:bg-accent transition px-5 py-4 flex items-start gap-4"
          >
            <span className="text-2xl" aria-hidden>✏️</span>
            <span className="flex-1">
              <span className="block font-medium text-foreground">Edit my story</span>
              <span className="block text-sm text-muted-foreground mt-0.5">
                Go back and keep working on it.
              </span>
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Your draft is saved privately. Only you can see it.
        </p>
      </motion.div>
    </motion.div>
  );
}

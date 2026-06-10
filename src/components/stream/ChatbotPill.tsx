// ChatbotPill — fixed bottom-center, text-only. The only entry to The Bench.
// When the chatbot has overridden the stream, the pill becomes a back-to-stream
// affordance instead of opening the overlay.
import { useEffect, useState } from "react";
import { useStreamStore } from "@/stores/stream";
import { ChatbotOverlay } from "./ChatbotOverlay";

const OVERRIDE_TIMEOUT_MS = 2 * 60 * 1000;

export function ChatbotPill() {
  const [open, setOpen] = useState(false);
  const active = useStreamStore((s) => s.chatbot_override_active);
  const setAt = useStreamStore((s) => s.override_set_at);
  const clearOverride = useStreamStore((s) => s.clearOverride);

  // Auto-clear override after 2 minutes of no further interaction.
  useEffect(() => {
    if (!active || !setAt) return;
    const remaining = OVERRIDE_TIMEOUT_MS - (Date.now() - setAt);
    if (remaining <= 0) { clearOverride(); return; }
    const t = setTimeout(clearOverride, remaining);
    return () => clearTimeout(t);
  }, [active, setAt, clearOverride]);

  const label = active ? "← Back to stream" : "Ask The Bench…";
  const onTap = () => { if (active) clearOverride(); else setOpen(true); };

  return (
    <>
      <button
        type="button"
        onClick={onTap}
        className="fixed left-1/2 -translate-x-1/2 z-40 px-5 h-11 text-[13px]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          background: "var(--c-surface-3, #e3ddd2)",
          color: "var(--c-text-2, #6b6457)",
          border: "0.5px solid var(--c-border-strong, #cfc6b3)",
          borderRadius: "var(--r-lg, 18px)",
          boxShadow: "0 6px 24px -10px rgba(0,0,0,0.18)",
        }}
      >
        {label}
      </button>

      <ChatbotOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

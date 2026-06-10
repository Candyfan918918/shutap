// ChatbotOverlay — 56px bottom-sheet input. The Bench listens.
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { chat } from "@/lib/chatbot.functions";
import { useStreamStore } from "@/stores/stream";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChatbotOverlay({ open, onClose }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ask = useServerFn(chat);
  const setOverride = useStreamStore((s) => s.setOverride);
  const clearOverride = useStreamStore((s) => s.clearOverride);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  async function submit() {
    const msg = value.trim();
    if (!msg || loading) return;
    setLoading(true);
    try {
      const r = await (ask as unknown as (a: { data: any }) => Promise<any>)({ data: { message: msg } });
      if (r?.error || !r?.data) {
        toast("The bench is hoarse. Try again.");
        return;
      }
      const { response_text, items, clear } = r.data;
      if (clear) {
        clearOverride();
      } else {
        setOverride({ response: response_text, items });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setValue("");
      onClose();
    } catch {
      toast("The bench is hoarse. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70]"
          onClick={onClose}
          style={{ background: "rgba(0,0,0,0.35)" }}
        >
          <motion.div
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => { if (info.offset.y > 60) onClose(); }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3"
            style={{
              height: 56,
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              background: "var(--c-surface, #fff)",
              borderTop: "0.5px solid var(--c-border, #e3ddd2)",
            }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
              disabled={loading}
              placeholder="What are you looking for?"
              className="flex-1 h-10 px-3 text-[14px] bg-transparent outline-none"
              style={{ color: "var(--c-text-1)" }}
            />
            {loading ? (
              <div className="flex items-center gap-1 px-3" aria-label="The bench is reading">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--c-text-2)" }}
                  />
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!value.trim()}
                aria-label="Send"
                className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-30"
                style={{ background: "var(--c-text-1)", color: "var(--c-surface, #fff)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

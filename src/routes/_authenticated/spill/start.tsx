import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTeaDraft } from "@/lib/spill.functions";
import { ReceiptsUploader } from "@/components/spill/ReceiptsUploader";
import type { ChatAttachment } from "@/lib/spill/types";
import { detectBrowserLocale, isLocale } from "@/lib/i18n";

const PLACEHOLDERS = [
  "He suddenly changed his password…",
  "My mother-in-law moved in…",
  "I found something weird in his car…",
  "We were perfect until…",
  "She said she was working late. She wasn't.",
  "婆婆把我们的婚纱照换了。",
  "我们的婚礼结束后24小时，他做了一件事…",
];

export const Route = createFileRoute("/_authenticated/spill/start")({
  component: SpillStart,
  validateSearch: (s: Record<string, unknown>) => ({ voice: Number(s.voice ?? 0) }),
  head: () => ({ meta: [{ title: "Spill it — Shutap" }] }),
});

function SpillStart() {
  const navigate = useNavigate();
  const create = useServerFn(createTeaDraft);
  const { voice } = Route.useSearch();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<unknown>(null);

  useEffect(() => {
    void supabase.auth.getUser().then((r) => setUserId(r.data.user?.id ?? null));
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (voice) startVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 400) + "px";
  };
  useEffect(autoGrow, [text]);

  const startVoice = () => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      toast.message("Voice input isn't supported on this browser — type it 💛");
      return;
    }
    const r = new (SR as unknown as new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    })();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    let buffer = "";
    r.onresult = (e) => {
      let chunk = "";
      for (let i = 0; i < e.results.length; i++) {
        chunk += e.results[i][0].transcript;
      }
      buffer = chunk;
      setText(chunk);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    try {
      r.start();
      recRef.current = r;
      setListening(true);
    } catch {
      /* ignore */
    }
  };
  const stopVoice = () => {
    const r = recRef.current as { stop?: () => void } | null;
    r?.stop?.();
    setListening(false);
  };

  const onSpill = async () => {
    if (submitting) return;
    if (!text.trim() && attachments.length === 0) {
      toast.message("Drop something — even one line ☕");
      return;
    }
    setSubmitting(true);
    try {
      const locale = (() => {
        const s = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
        return isLocale(s) ? s : detectBrowserLocale();
      })();
      const { draftId } = await create({
        data: { rawDump: text, attachments, locale },
      });
      navigate({ to: "/spill/$draftId/chat", params: { draftId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start. Try again?");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <button onClick={() => history.back()} className="text-sm text-muted-foreground">
            ← Back
          </button>
          <span className="text-xs font-semibold tracking-widest text-primary">☕ SPILLING</span>
          <span className="w-12" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-40">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl font-bold leading-tight text-balance"
        >
          okay so basically…
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-1">
          ramble. it's just us. no character limit. no judgement.
        </p>

        <div className="mt-5 relative">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDERS[phIdx]}
            className="w-full min-h-[180px] bg-surface-elevated border border-border rounded-3xl p-5 text-lg leading-relaxed resize-none focus:outline-none focus:border-primary/60 transition placeholder:text-muted-foreground"
          />
          {listening && (
            <div className="absolute top-3 right-3 flex items-center gap-2 text-xs text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              listening…
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                {a.kind === "video" ? (
                  <video src={a.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => setAttachments((s) => s.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-black/70 text-white text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground text-center">
          texts? screenshots? emotional damage evidence? 👇
        </p>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          {userId && (
            <ReceiptsUploader
              draftId="pending"
              userId={userId}
              compact
              onUploaded={(atts) => setAttachments((s) => [...s, ...atts])}
            />
          )}
          <button
            onClick={listening ? stopVoice : startVoice}
            className={`shrink-0 grid place-items-center h-10 w-10 rounded-full border transition ${
              listening
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface-elevated border-border hover:border-primary/60"
            }`}
            title="Speak instead"
          >
            🎙
          </button>
          <button
            onClick={onSpill}
            disabled={submitting}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold disabled:opacity-50"
          >
            {submitting ? "Pouring…" : "Spill it →"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTeaDraft,
  sendChatTurn,
  attachTeaMedia,
} from "@/lib/spill.functions";
import { ChatBubble, TypingDots } from "@/components/spill/ChatBubble";
import { DynamicQuestion } from "@/components/spill/DynamicQuestion";
import { ReceiptsUploader } from "@/components/spill/ReceiptsUploader";
import type { ChatAttachment, ChatMessage, SpillDraftRow } from "@/lib/spill/types";

export const Route = createFileRoute("/_authenticated/spill/$draftId/chat")({
  component: SpillChat,
  head: () => ({ meta: [{ title: "Tell me everything — Shutap" }] }),
});

function SpillChat() {
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getTeaDraft);
  const send = useServerFn(sendChatTurn);
  const attach = useServerFn(attachTeaMedia);

  const [draft, setDraft] = useState<SpillDraftRow | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then((r) => setUserId(r.data.user?.id ?? null));
  }, []);

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
    r.onresult = (e) => {
      let chunk = "";
      for (let i = 0; i < e.results.length; i++) chunk += e.results[i][0].transcript;
      setInput(chunk);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    try { r.start(); recRef.current = r; setListening(true); } catch { /* ignore */ }
  };
  const stopVoice = () => {
    const r = recRef.current as { stop?: () => void } | null;
    r?.stop?.();
    setListening(false);
  };

  // Load draft, then fire first AI turn if no AI message yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { draft: row } = await load({ data: { draftId } });
        if (cancelled) return;
        setDraft(row);
        const hasAi = (row.chat_messages ?? []).some((m) => m.role === "ai");
        if (!hasAi) {
          await runAiTurn("");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load draft");
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [draft?.chat_messages?.length, aiThinking]);

  const runAiTurn = async (text: string, attachments: ChatAttachment[] = []) => {
    setAiThinking(true);
    try {
      const { draft: updated } = await send({
        data: { draftId, userText: text, attachments },
      });
      setDraft(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tea is glitching, try again");
    } finally {
      setAiThinking(false);
    }
  };

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || aiThinking) return;
    setInput("");
    await runAiTurn(trimmed);
  };

  const onAnswer = async (text: string) => {
    if (aiThinking) return;
    await runAiTurn(text);
  };

  const onUploaded = async (atts: ChatAttachment[]) => {
    try {
      const { draft: updated } = await attach({ data: { draftId, attachments: atts } });
      setDraft(updated);
      // Let AI react to the receipts.
      await runAiTurn("📱 here, look");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const onGoScore = () => {
    navigate({ to: "/spill/$draftId/scoring", params: { draftId } });
  };

  const lastAi = [...(draft?.chat_messages ?? [])].reverse().find((m) => m.role === "ai");
  const currentQuestion = !aiThinking ? lastAi?.question : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <button onClick={() => history.back()} className="text-sm text-muted-foreground">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-xs">
              ☕
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Tea</div>
              <div className="text-[10px] text-muted-foreground">your nosiest friend</div>
            </div>
          </div>
          <span className="w-12" />
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-40">
          {draftLoading && (
            <div className="text-center text-sm text-muted-foreground py-10">
              pulling up your tea…
            </div>
          )}

          {(draft?.chat_messages ?? []).map((m: ChatMessage) => (
            <ChatBubble key={m.id} message={m} />
          ))}

          {aiThinking && <TypingDots />}

          <AnimatePresence>
            {!aiThinking && currentQuestion && currentQuestion.type !== "text" && (
              <motion.div
                key="dyn"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 mb-1"
              >
                <DynamicQuestion question={currentQuestion} onAnswer={onAnswer} />
              </motion.div>
            )}
          </AnimatePresence>

          {draft?.ready_for_score && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10 p-5 text-center"
            >
              <p className="text-sm">okay babe… I have enough 👀</p>
              <button
                onClick={onGoScore}
                className="mt-4 w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
              >
                🚨 Run the chaos numbers →
              </button>
            </motion.div>
          )}
        </div>
      </main>

      {!draft?.ready_for_score && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-end gap-2">
            {userId && (
              <ReceiptsUploader
                draftId={draftId}
                userId={userId}
                compact
                onUploaded={onUploaded}
              />
            )}
            <button
              onClick={listening ? stopVoice : startVoice}
              type="button"
              className={`shrink-0 grid place-items-center h-10 w-10 rounded-full border transition ${
                listening
                  ? "bg-primary text-primary-foreground border-primary animate-pulse"
                  : "bg-surface-elevated border-border hover:border-primary/60"
              }`}
              title="Speak instead"
            >
              🎙
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder={
                listening
                  ? "listening… keep talking 🎙"
                  : currentQuestion?.type === "text"
                  ? (currentQuestion as { placeholder?: string }).placeholder ?? "say more…"
                  : "type or tap 🎙 to speak…"
              }
              rows={1}
              className="flex-1 bg-surface-elevated border border-border rounded-3xl px-4 py-2.5 text-[15px] resize-none max-h-32 focus:outline-none focus:border-primary/60"
            />
            <button
              onClick={() => void onSend()}
              disabled={aiThinking || !input.trim()}
              className="shrink-0 h-10 px-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

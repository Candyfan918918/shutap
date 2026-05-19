import { motion } from "framer-motion";
import type { ChatMessage } from "@/lib/spill/types";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}
    >
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-surface-elevated text-foreground rounded-bl-md border border-border"
        }`}
      >
        {!isUser && (
          <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">☕ Tea</div>
        )}
        {message.text && <p>{message.text}</p>}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {message.attachments.map((a, i) =>
              a.kind === "image" ? (
                <img
                  key={i}
                  src={a.url}
                  alt=""
                  className="rounded-xl object-cover aspect-square"
                />
              ) : a.kind === "video" ? (
                <video
                  key={i}
                  src={a.url}
                  controls
                  className="rounded-xl object-cover aspect-square"
                />
              ) : (
                <div key={i} className="text-xs opacity-80">
                  🎙 {a.name ?? "voice note"}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TypingDots() {
  return (
    <div className="flex justify-start mb-2">
      <div className="bg-surface-elevated border border-border rounded-3xl rounded-bl-md px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-foreground/60"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{
              duration: 1.0,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

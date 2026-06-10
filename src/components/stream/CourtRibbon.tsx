// CourtRibbon — amber pill, 1s countdown tick. Pulse <60min, coral pulse <10min.
import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

interface Props {
  category: string | null;
  tier: string | null;
  lockAt: string | null;
  className?: string;
}

export function CourtRibbon({ category, tier, lockAt, className = "" }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!lockAt) return null;
  const ms = new Date(lockAt).getTime() - now;
  const minutesLeft = Math.max(0, Math.floor(ms / 60000));
  const isFinal60 = minutesLeft <= 60;
  const isFinal10 = minutesLeft <= 10;

  const bg = isFinal10 ? "var(--c-coral, #ff7a6b)" : "var(--c-amber, #f5b840)";
  const fg = "#1a1a1a";
  const pulseClass = isFinal10
    ? "animate-[ribbonPulse_650ms_ease-in-out_infinite]"
    : isFinal60
      ? "animate-[ribbonPulse_1400ms_ease-in-out_infinite]"
      : "";

  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Court";
  const catLabel = category ?? "General";

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 h-6 text-[10px] font-semibold uppercase tracking-[0.04em] ${pulseClass} ${className}`}
      style={{
        background: bg,
        color: fg,
        borderRadius: "var(--r-pill, 9999px)",
      }}
    >
      <span>{catLabel} Court</span>
      <span aria-hidden>·</span>
      <span>{tierLabel}</span>
      <span aria-hidden>·</span>
      <span tabular-nums="true" className="tabular-nums">{formatRemaining(ms)}</span>
      <style>{`@keyframes ribbonPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .72; transform: scale(0.98); } }`}</style>
    </div>
  );
}

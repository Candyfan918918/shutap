// RelateButton — distinct (not a heart). Teal fill when active.
// Anonymous taps fire SoftGate; signed-in taps call relateToPost via parent.
import { useState } from "react";

interface Props {
  count: number;
  active?: boolean;
  onActivate: () => Promise<void> | void;
  compact?: boolean;
}

export function RelateButton({ count, active = false, onActivate, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(active);
  const [n, setN] = useState(count);

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      // Optimistic
      const willActivate = !local;
      setLocal(willActivate);
      setN((x) => Math.max(0, x + (willActivate ? 1 : -1)));
      await onActivate();
    } finally {
      setBusy(false);
    }
  }

  const color = local ? "var(--c-teal, #3aa48f)" : "var(--c-text-2, #555)";
  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={local}
      className={`inline-flex items-center gap-1.5 transition active:scale-[0.96] ${compact ? "text-[11px]" : "text-[12px]"}`}
      style={{ color }}
    >
      <svg
        width={compact ? 14 : 16}
        height={compact ? 14 : 16}
        viewBox="0 0 24 24"
        fill={local ? color : "none"}
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Two concentric arcs — "felt this" sigil */}
        <path d="M4 14c2.5-4 5-6 8-6s5.5 2 8 6" />
        <circle cx="12" cy="14" r="2.5" />
      </svg>
      <span className="tabular-nums">{n}</span>
      {!compact && <span style={{ color: "var(--c-text-3)" }}>felt this</span>}
    </button>
  );
}

// Sticky top progress bar with rotating status messages.
import { useEffect, useState } from "react";

const STATUSES_EN = [
  "Emotionally preparing ourselves…",
  "Scanning for plot twists…",
  "Checking emotional damage…",
  "Detecting mother-in-law energy…",
  "Looking for unresolved arguments…",
  "Measuring chaos density…",
  "Counting silent treatments…",
  "Calibrating love bonus ❤️…",
];

const STATUSES_ZH = [
  "情绪上准备中…",
  "扫描剧情反转…",
  "检测情感伤害值…",
  "侦测婆婆能量…",
  "寻找未解决的争吵…",
  "计算混乱密度…",
  "数冷战次数…",
  "校准甜蜜加分 ❤️…",
];

export function ScanProgress({
  step,
  total,
  etaSeconds,
  locale,
  onBack,
}: {
  step: number;
  total: number;
  etaSeconds: number;
  locale: string;
  onBack?: () => void;
}) {
  const pool = locale === "zh" ? STATUSES_ZH : STATUSES_EN;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 2400);
    return () => clearInterval(t);
  }, [pool.length]);

  const percent = total === 0 ? 0 : Math.round((step / total) * 100);
  const minutes = Math.max(1, Math.ceil(etaSeconds / 60));

  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-xl px-4 pt-3 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            className="px-2 py-1 rounded-md hover:bg-surface-elevated disabled:opacity-30"
          >
            ←
          </button>
          <span className="tabular-nums font-medium">
            {Math.min(step + 1, total)} / {total}
          </span>
          <span className="tabular-nums">~{minutes}m</span>
        </div>
        <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground italic text-center min-h-[16px]">
          {pool[idx]}
        </div>
      </div>
    </div>
  );
}

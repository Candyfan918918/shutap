// Cinematic result reveal: count-up score, gradient backdrop, subscore bars,
// badges, commentary. SSR-safe (visible by default; animations layer on top).
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bandForScore, type ScoreResult } from "@/lib/scan/types";

const SUBSCORE_LABELS_EN: Record<string, { label: string; max: number; goodWhenLow: boolean }> = {
  plot_twists: { label: "Plot Twist Index", max: 200, goodWhenLow: true },
  emotional: { label: "Emotional Damage", max: 200, goodWhenLow: true },
  financial: { label: "Financial Chaos", max: 150, goodWhenLow: true },
  family: { label: "Family Drama", max: 150, goodWhenLow: true },
  communication: { label: "Communication Disaster", max: 150, goodWhenLow: true },
  love_bonus: { label: "Love Bonus ❤️", max: 200, goodWhenLow: false },
};
const SUBSCORE_LABELS_ZH: Record<string, { label: string; max: number; goodWhenLow: boolean }> = {
  plot_twists: { label: "剧情反转指数", max: 200, goodWhenLow: true },
  emotional: { label: "情感伤害值", max: 200, goodWhenLow: true },
  financial: { label: "财务混乱度", max: 150, goodWhenLow: true },
  family: { label: "家庭戏份", max: 150, goodWhenLow: true },
  communication: { label: "沟通灾难等级", max: 150, goodWhenLow: true },
  love_bonus: { label: "甜蜜加分 ❤️", max: 200, goodWhenLow: false },
};

export function ScoreReveal({
  result,
  locale,
  displayName,
  cityLabel,
}: {
  result: ScoreResult;
  locale: string;
  displayName?: string;
  cityLabel?: string;
}) {
  const band = bandForScore(result.totalScore);
  const labels = locale === "zh" ? SUBSCORE_LABELS_ZH : SUBSCORE_LABELS_EN;

  const display = useCountUp(result.totalScore, 1600);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-surface border border-border p-8 shadow-sm">
        <div className="relative text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {locale === "zh" ? "关系狗血指数™" : "Relationship Chaos Score™"}
          </div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }}
            className="text-8xl sm:text-9xl font-medium tabular-nums leading-none mt-3 text-primary"
          >
            {display}
          </motion.div>
          <div className="text-sm text-muted-foreground mt-1">/ 1000</div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tag-peach text-tag-peach-foreground text-base font-medium"
          >
            <span>{band.emoji}</span>
            <span>{result.category}</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="font-display mt-4 text-xl leading-snug max-w-sm mx-auto text-balance text-foreground"
          >
            "{band.commentary}"
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="mt-3 text-xs text-muted-foreground"
          >
            Higher than{" "}
            <span className="font-medium tabular-nums text-foreground">{result.percentile}%</span> of
            relationships we've scanned
          </motion.div>
          {(displayName || cityLabel) && (
            <div className="mt-4 text-xs text-muted-foreground">
              {cityLabel ? `${cityLabel} · ` : ""}
              {displayName ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* Subscore bars */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {locale === "zh" ? "分项得分" : "How it broke down"}
        </h3>
        {(Object.keys(labels) as Array<keyof typeof labels>).map((k) => {
          const meta = labels[k];
          const raw = (result.subscores as unknown as Record<string, number>)[k as string] ?? 0;
          const absVal = Math.abs(raw);
          const pct = Math.round((absVal / meta.max) * 100);
          const isBonus = k === "love_bonus";
          return (
            <div key={k as string}>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{meta.label}</span>
                <span className="tabular-nums">
                  {isBonus ? Math.round(raw) : Math.round(absVal)} / {isBonus ? -200 : meta.max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ delay: 1.8, duration: 0.8, ease: "easeOut" }}
                  className={`h-full ${isBonus ? "bg-tag-pink-foreground/80" : "bg-primary"}`}
                  style={{ opacity: isBonus ? 1 : Math.max(0.45, Math.min(1, pct / 100 + 0.4)) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {locale === "zh" ? "你的徽章" : "Your badges"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {result.badges.map((b) => (
            <span
              key={b}
              className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs font-medium"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function useCountUp(to: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return value;
}

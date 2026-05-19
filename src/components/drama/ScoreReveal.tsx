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

  const gradient =
    band.key === "legendary"
      ? "from-[oklch(0.55_0.22_300)] via-[oklch(0.5_0.22_350)] to-[oklch(0.55_0.22_25)]"
      : band.key === "courtroom"
      ? "from-[oklch(0.55_0.22_25)] to-[oklch(0.5_0.2_340)]"
      : band.key === "netflix"
      ? "from-[oklch(0.55_0.2_25)] to-[oklch(0.5_0.2_50)]"
      : band.key === "snacks_therapy"
      ? "from-[oklch(0.6_0.18_60)] to-[oklch(0.55_0.18_30)]"
      : band.key === "functional"
      ? "from-[oklch(0.55_0.16_200)] to-[oklch(0.5_0.15_280)]"
      : "from-[oklch(0.65_0.15_160)] to-[oklch(0.55_0.15_200)]";

  const display = useCountUp(result.totalScore, 1600);

  return (
    <div className="space-y-6">
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} text-white p-8 shadow-2xl`}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative text-center">
          <div className="text-xs uppercase tracking-[0.3em] opacity-80">
            {locale === "zh" ? "关系狗血指数™" : "Relationship Chaos Score™"}
          </div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }}
            className="text-8xl sm:text-9xl font-black tabular-nums leading-none mt-3 drop-shadow-2xl"
          >
            {display}
          </motion.div>
          <div className="text-sm opacity-80 mt-1">/ 1000</div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur text-base font-bold"
          >
            <span>{band.emoji}</span>
            <span>{result.category}</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-4 text-base opacity-95 italic max-w-sm mx-auto text-balance"
          >
            "{band.commentary}"
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="mt-3 text-xs opacity-80"
          >
            Higher than{" "}
            <span className="font-bold tabular-nums">{result.percentile}%</span> of
            marriages we've scanned
          </motion.div>
          {(displayName || cityLabel) && (
            <div className="mt-4 text-xs opacity-70">
              {cityLabel ? `${cityLabel} · ` : ""}
              {displayName ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* Subscore bars */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className={`h-full ${
                    isBonus
                      ? "bg-gradient-to-r from-pink-400 to-rose-400"
                      : pct >= 70
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : pct >= 40
                      ? "bg-gradient-to-r from-orange-400 to-yellow-400"
                      : "bg-gradient-to-r from-emerald-400 to-teal-400"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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

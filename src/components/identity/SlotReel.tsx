// Vertical-scrolling slot reel with blurred top/bottom edges.
// Spins through `pool` until `locked` flips, then snaps to `value` with a
// 1.0 → 1.06 → 1.0 bounce over 200ms.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const ITEM_HEIGHT = 44; // px per reel cell — keep in sync with className h-11
const VISIBLE = 3;       // number of rows visible (with edges blurred)

export function SlotReel({
  pool,
  value,
  locked,
  speedMs = 70,
}: {
  pool: string[] | undefined;
  value: string | undefined;
  locked: boolean;
  speedMs?: number;
}) {
  const fallback = useMemo(() => ["…", "·", "·", "·", "·"], []);
  const list = pool && pool.length > 0 ? pool : fallback;

  // Build a long strip so vertical scroll feels continuous.
  const strip = useMemo(() => {
    const repeats = Math.max(4, Math.ceil(40 / list.length));
    const s: string[] = [];
    for (let i = 0; i < repeats; i++) s.push(...list);
    return s;
  }, [list]);

  const [offset, setOffset] = useState(0);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (locked) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      const stepEvery = speedMs;
      if (acc >= stepEvery) {
        const steps = Math.floor(acc / stepEvery);
        acc -= steps * stepEvery;
        setOffset((o) => (o + steps) % strip.length);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [locked, speedMs, strip.length]);

  const display = locked && value ? value : strip[offset % strip.length];

  return (
    <motion.div
      animate={locked ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-xl border ${
        locked
          ? "bg-primary border-primary/50"
          : "bg-background border-border"
      }`}
      style={{ height: ITEM_HEIGHT * VISIBLE }}
    >
      {/* Edge blur masks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-5 z-10 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 z-10 bg-gradient-to-t from-background to-transparent" />

      {locked ? (
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span className="truncate text-[13px] sm:text-sm font-medium text-foreground text-center">
            {display}
          </span>
        </div>
      ) : (
        <div
          className="absolute inset-x-0"
          style={{
            top: "50%",
            transform: `translateY(-${ITEM_HEIGHT / 2}px)`,
          }}
        >
          {[-1, 0, 1].map((delta) => {
            const idx = ((offset + delta) % strip.length + strip.length) % strip.length;
            const opacity = delta === 0 ? 1 : 0.35;
            const blur = delta === 0 ? 0 : 2;
            return (
              <div
                key={delta}
                style={{
                  height: ITEM_HEIGHT,
                  opacity,
                  filter: `blur(${blur}px)`,
                  transform: `translateY(${delta * ITEM_HEIGHT}px)`,
                }}
                className="absolute inset-x-0 flex items-center justify-center px-2"
              >
                <span className="truncate text-[12px] sm:text-[13px] font-medium text-muted-foreground text-center">
                  {strip[idx]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export function clickTone(hz: number, volume = 0.3, durationMs = 80) {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    osc.type = "triangle";
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => ctx.close(), durationMs + 100);
  } catch { /* silent */ }
}

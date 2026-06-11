// Slot reel tones — three sine pings via Web Audio, no external files.
// Call playSlotTone(0|1|2) when each reel locks.
const FREQS = [440, 460, 480] as const;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  return ctx;
}

export function playSlotTone(reelIndex: 0 | 1 | 2): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = FREQS[reelIndex];
    gain.gain.value = 0.3;
    osc.connect(gain).connect(ac.destination);
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.085);
  } catch {
    /* audio not available; ignore */
  }
}

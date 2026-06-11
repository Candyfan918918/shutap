// Crisis resources card — quiet, non-blocking. Renders below the co-pilot
// question when the risk classifier flags crisis_signal=true. Posting is
// never blocked from here; the user's autonomy is respected.
import { useState } from "react";

type Props = { onDismiss?: () => void };

export function CrisisCard({ onDismiss }: Props) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <aside
      className="rounded-xl border border-teal-400/50 bg-card/60 p-4 my-3 text-sm"
      style={{ borderWidth: 0.5 }}
      role="note"
      aria-label="Support resources"
    >
      <p className="text-foreground">This sounds hard. If you need support:</p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>
          Crisis Text Line — text <span className="text-foreground">HOME to 741741</span> (US/CA/UK/IE).
        </li>
        <li>
          SAMHSA — <a className="text-foreground underline" href="tel:18006624357">1-800-662-4357</a> (US, 24/7).
        </li>
      </ul>
      <button
        type="button"
        onClick={() => { setHidden(true); onDismiss?.(); }}
        className="mt-3 text-xs text-muted-foreground hover:text-foreground"
      >
        I'm okay — continue
      </button>
    </aside>
  );
}

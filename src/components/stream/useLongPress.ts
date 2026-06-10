// useLongPress — 450ms pointerdown threshold, cancels on move/up.
import { useRef } from "react";

export function useLongPress(onLong: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const start = () => {
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLong();
    }, ms);
  };
  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  return {
    didTrigger: () => triggered.current,
    handlers: {
      onPointerDown: start,
      onPointerMove: clear,
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
  };
}

// 6-digit OTP input with auto-advance, paste-distribute, and auto-submit.
import { useEffect, useRef, useState } from "react";

export function OtpInput({
  length = 6,
  onComplete,
  disabled,
  autoFocus = true,
}: {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [values, setValues] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, char: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = char;
      const joined = next.join("");
      if (joined.length === length && next.every(Boolean)) {
        onComplete(joined);
      }
      return next;
    });
  };

  const onChange = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setAt(i, "");
      return;
    }
    if (digits.length === 1) {
      setAt(i, digits);
      refs.current[Math.min(i + 1, length - 1)]?.focus();
      return;
    }
    // pasted multiple
    const chars = digits.slice(0, length - i).split("");
    setValues((prev) => {
      const next = [...prev];
      for (let k = 0; k < chars.length; k++) next[i + k] = chars[k];
      const joined = next.join("");
      if (joined.length === length && next.every(Boolean)) onComplete(joined);
      return next;
    });
    const last = Math.min(i + chars.length, length - 1);
    refs.current[last]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !values[i] && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl bg-surface-elevated border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 tabular-nums"
        />
      ))}
    </div>
  );
}

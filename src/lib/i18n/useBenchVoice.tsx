// Client hook + provider for Bench-voice localized strings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchBenchBundle } from "./bench.functions";

type Bundle = Record<string, string>;
interface Ctx {
  locale: string;
  strings: Bundle;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const BenchCtx = createContext<Ctx | null>(null);

function interpolate(t: string, vars?: Record<string, string | number>) {
  if (!vars) return t;
  return t.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function BenchVoiceProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [strings, setStrings] = useState<Bundle>({});

  useEffect(() => {
    let cancelled = false;
    fetchBenchBundle({ data: { locale } })
      .then((res) => {
        if (!cancelled) setStrings(res.strings);
      })
      .catch(() => {
        /* fall back to keys */
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const tmpl = strings[key] ?? key;
      return interpolate(tmpl, vars);
    },
    [strings],
  );

  const value = useMemo(() => ({ locale, strings, t }), [locale, strings, t]);
  return <BenchCtx.Provider value={value}>{children}</BenchCtx.Provider>;
}

export function useBenchVoice(): Ctx {
  const ctx = useContext(BenchCtx);
  if (ctx) return ctx;
  // Fallback when used outside provider: identity passthrough.
  return {
    locale: "en",
    strings: {},
    t: (k, v) => interpolate(k, v),
  };
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { t as translate, type Locale, type MessageKey } from "./index";

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key, vars) => translate(locale, key, vars) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}

import { DEFAULT_LOCALE, MESSAGES, SUPPORTED_LOCALES, type Locale, type Messages } from "./messages";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, MESSAGES } from "./messages";
export type { Locale, Messages } from "./messages";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = (navigator.languages?.length ? navigator.languages : [navigator.language]) ?? [];
  for (const raw of candidates) {
    if (!raw) continue;
    const lower = raw.toLowerCase();
    const short = lower.split("-")[0];
    if (lower.startsWith("zh")) return "zh";
    if (isLocale(short)) return short;
  }
  return DEFAULT_LOCALE;
}

type LeafPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : LeafPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = LeafPaths<Messages>;

function resolvePath(obj: unknown, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj) as string | undefined;
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const value = resolvePath(MESSAGES[locale], key) ?? resolvePath(MESSAGES[DEFAULT_LOCALE], key) ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

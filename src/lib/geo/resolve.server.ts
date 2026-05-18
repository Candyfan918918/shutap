// Server-only geo resolver. Reads Cloudflare Workers request headers and falls
// back to Accept-Language for locale. No external API call.
import { getRequest } from "@tanstack/react-start/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

export interface GeoResult {
  country: string | null;   // ISO 3166-1 alpha-2, uppercase
  region: string | null;
  city: string | null;
  locale: Locale;
}

const COUNTRY_LOCALE: Record<string, Locale> = {
  CN: "zh", HK: "zh", TW: "zh", SG: "zh",
  JP: "ja",
  KR: "ko",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es",
  PT: "pt", BR: "pt",
};

function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // e.g. "zh-CN,zh;q=0.9,en;q=0.8"
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    if (tag.startsWith("zh")) return "zh";
    const short = tag.split("-")[0];
    if (isLocale(short)) return short;
  }
  return null;
}

export function resolveGeoFromRequest(): GeoResult {
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  let accept: string | null = null;

  try {
    const request = getRequest();
    const h = request.headers;
    country = h.get("cf-ipcountry");
    region = h.get("cf-region");
    city = h.get("cf-ipcity");
    accept = h.get("accept-language");
  } catch {
    // No request context (e.g. running outside a server-fn handler)
  }

  if (city) {
    try { city = decodeURIComponent(city); } catch { /* keep as-is */ }
  }
  if (region) {
    try { region = decodeURIComponent(region); } catch { /* keep as-is */ }
  }
  const cc = country && country !== "XX" ? country.toUpperCase() : null;

  const locale: Locale =
    (cc && COUNTRY_LOCALE[cc]) ||
    parseAcceptLanguage(accept) ||
    DEFAULT_LOCALE;

  return { country: cc, region, city, locale };
}

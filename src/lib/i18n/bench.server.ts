// Bench-voice multi-language string lookup. Server side, with per-worker cache.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Cache = { loadedAt: number; rows: Map<string, string> };
let _cache: Cache | null = null;
const TTL_MS = 5 * 60 * 1000;

async function load(): Promise<Cache> {
  if (_cache && Date.now() - _cache.loadedAt < TTL_MS) return _cache;
  const { data } = await supabaseAdmin
    .from("bench_voice_strings")
    .select("key, locale, text");
  const rows = new Map<string, string>();
  for (const r of (data ?? []) as any[]) {
    rows.set(`${r.locale}::${r.key}`, r.text);
  }
  _cache = { loadedAt: Date.now(), rows };
  return _cache;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

/** Server-side localized Bench string with locale → base → 'en' fallback. */
export async function bench(
  key: string,
  locale: string | null | undefined,
  vars?: Record<string, string | number>,
): Promise<string> {
  const c = await load();
  const tried = new Set<string>();
  const tries: string[] = [];
  const loc = (locale ?? "en").trim() || "en";
  tries.push(loc);
  if (loc.includes("-")) tries.push(loc.split("-")[0]);
  tries.push("en");
  for (const l of tries) {
    if (tried.has(l)) continue;
    tried.add(l);
    const hit = c.rows.get(`${l}::${key}`);
    if (hit) return interpolate(hit, vars);
  }
  return key;
}

export function invalidateBenchCache() {
  _cache = null;
}

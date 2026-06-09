// Public server fn that hands the browser a localized Bench string bundle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchBenchBundle = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ locale: z.string().min(2).max(10).default("en") }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = data.locale.includes("-") ? data.locale.split("-")[0] : null;
    const locales = Array.from(new Set([data.locale, base, "en"].filter(Boolean) as string[]));
    const { data: rows } = await supabaseAdmin
      .from("bench_voice_strings")
      .select("key, locale, text")
      .in("locale", locales);
    // Merge with priority: requested → base → en.
    const merged: Record<string, string> = {};
    const priority = new Map(locales.map((l, i) => [l, i] as const));
    const seen = new Map<string, number>();
    for (const r of (rows ?? []) as any[]) {
      const pr = priority.get(r.locale) ?? 99;
      const cur = seen.get(r.key);
      if (cur === undefined || pr < cur) {
        merged[r.key] = r.text;
        seen.set(r.key, pr);
      }
    }
    return { locale: data.locale, strings: merged };
  });

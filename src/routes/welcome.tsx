import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { finalizeIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { generateAlias, type GeneratedAlias } from "@/lib/alias.functions";
import { AvatarSvg } from "@/components/identity/AvatarSvg";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Shutap" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: WelcomeShell,
});

function WelcomeShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  return (
    <I18nProvider locale={locale}>
      <WelcomePage />
    </I18nProvider>
  );
}

function WelcomePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { redirect: redirectSearch } = Route.useSearch();
  const finalize = useServerFn(finalizeIdentity);
  const fetchAlias = useServerFn(generateAlias);

  const [identity, setIdentity] = useState<IdentityPayload | null>(null);
  const [alias, setAlias] = useState<GeneratedAlias | null>(null);
  const [locks, setLocks] = useState({ n: false, e: false, c: false });
  const [phase, setPhase] = useState<"spin" | "reveal">("spin");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Resolve redirect destination from search or sessionStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("md.postAuthRedirect");
    setRedirectTo(redirectSearch || stored || null);
  }, [redirectSearch]);

  // Kick off: ensure session, fetch alias + finalize in parallel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/enter", search: { redirect: redirectSearch } });
        return;
      }
      try {
        const [ident, al] = await Promise.all([
          finalize({ data: {} }),
          fetchAlias({ data: {} }).catch(() => null),
        ]);
        if (cancelled) return;
        if (al) setAlias(al);
        setIdentity(ident);
        if (ident.locale) localStorage.setItem("md.locale", ident.locale);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => { cancelled = true; };
  }, [finalize, fetchAlias, navigate, redirectSearch]);

  // Run lock sequence once both alias + identity are ready.
  const lockTimers = useRef<number[]>([]);
  useEffect(() => {
    if (!alias || !identity || phase !== "spin") return;
    lockTimers.current.forEach((id) => window.clearTimeout(id));
    lockTimers.current = [];
    const t1 = window.setTimeout(() => { setLocks((l) => ({ ...l, n: true })); clickTone(440); }, 900);
    const t2 = window.setTimeout(() => { setLocks((l) => ({ ...l, e: true })); clickTone(520); }, 1500);
    const t3 = window.setTimeout(() => { setLocks((l) => ({ ...l, c: true })); clickTone(620); }, 2100);
    const t4 = window.setTimeout(() => setPhase("reveal"), 2700);
    lockTimers.current = [t1, t2, t3, t4];
    return () => { lockTimers.current.forEach((id) => window.clearTimeout(id)); };
  }, [alias, identity, phase]);

  // Auto-continue to redirect once revealed.
  useEffect(() => {
    if (phase !== "reveal" || !redirectTo) return;
    const safe = redirectTo.startsWith("/") && !redirectTo.startsWith("//");
    if (!safe) return;
    const id = window.setTimeout(() => {
      try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {}
      window.location.replace(redirectTo);
    }, 1600);
    return () => window.clearTimeout(id);
  }, [phase, redirectTo]);

  const flag = identity?.countryCode ? countryFlag(identity.countryCode) : "";

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {phase === "spin" ? "The court is assigning your identity" : "The court has spoken"}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-surface-elevated border border-border p-3">
          <Reel pool={alias?.reelPools.nationality} value={alias?.nationality} locked={locks.n} />
          <Reel pool={alias?.reelPools.emotion} value={alias?.emotion} locked={locks.e} />
          <Reel pool={alias?.reelPools.creature} value={alias?.creature} locked={locks.c} />
        </div>

        <AnimatePresence mode="wait">
          {phase === "reveal" && identity ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0, filter: "blur(16px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                transition={{ type: "spring", damping: 14, stiffness: 110 }}
                className="mx-auto"
              >
                <AvatarSvg src={identity.avatarUrl} size={140} alt={identity.displayName} />
              </motion.div>
              <h1 className="mt-5 text-2xl sm:text-3xl font-medium text-balance leading-tight">
                {identity.displayName}
              </h1>
              {(flag || identity.city) && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {flag} {identity.city ?? identity.countryCode ?? ""}
                </p>
              )}
              <div className="mt-8 space-y-2">
                {redirectTo ? (
                  <a
                    href={redirectTo}
                    onClick={() => { try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {} }}
                    className="block w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium text-center"
                  >
                    Continue →
                  </a>
                ) : (
                  <Link
                    to="/"
                    className="block w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium text-center"
                  >
                    {t("welcome.cta")}
                  </Link>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="spinning"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-6 text-center text-sm text-muted-foreground"
            >
              Hold. The reels are deciding.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Reel({
  pool, value, locked,
}: { pool: string[] | undefined; value: string | undefined; locked: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (locked) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 70);
    return () => window.clearInterval(id);
  }, [locked]);
  const fallback = ["…", "·", "·"];
  const list = pool && pool.length > 0 ? pool : fallback;
  const display = locked && value ? value : list[tick % list.length];
  return (
    <motion.div
      animate={locked ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`h-14 rounded-xl flex items-center justify-center text-center px-2 font-medium text-[13px] sm:text-sm leading-tight ${
        locked
          ? "bg-primary border border-primary/50 text-foreground"
          : "bg-background border border-border text-muted-foreground"
      }`}
    >
      <span className="truncate">{display}</span>
    </motion.div>
  );
}

function clickTone(hz: number) {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    osc.type = "triangle";
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 200);
  } catch {/* silent */}
}

function countryFlag(cc: string): string {
  if (!/^[A-Z]{2}$/i.test(cc)) return "";
  const base = 0x1f1e6;
  const A = "A".charCodeAt(0);
  return String.fromCodePoint(
    base + (cc.toUpperCase().charCodeAt(0) - A),
    base + (cc.toUpperCase().charCodeAt(1) - A),
  );
}

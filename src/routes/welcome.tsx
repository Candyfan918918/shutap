import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { finalizeIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { AvatarSvg } from "@/components/identity/AvatarSvg";
import { markFirstSession } from "@/lib/firstSession";

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
  const [identity, setIdentity] = useState<IdentityPayload | null>(null);
  const [rolling, setRolling] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Resolve intended post-auth destination. Prefer search param; fall back
  // to sessionStorage (set by /enter) so OAuth round-trips still work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("md.postAuthRedirect");
    const target = redirectSearch || stored || null;
    setRedirectTo(target);
  }, [redirectSearch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/enter", search: { redirect: undefined } });
        return;
      }
      try {
        const ident = await finalize({ data: {} });
        if (!cancelled) {
          setIdentity(ident);
          if (ident.locale) localStorage.setItem("md.locale", ident.locale);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setRolling(false);
      }
    })();
    return () => { cancelled = true; };
  }, [finalize, navigate]);

  // Auto-continue to intended destination after identity has loaded so users
  // don't have to manually re-tap a card to land where they wanted to go.
  useEffect(() => {
    if (!identity || !redirectTo) return;
    const isSafe = redirectTo.startsWith("/") && !redirectTo.startsWith("//");
    if (!isSafe) return;
    const t = setTimeout(() => {
      try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {}
      markFirstSession({ aliasLine: identity.displayName });
      window.location.replace(redirectTo);
    }, 900);
    return () => clearTimeout(t);
  }, [identity, redirectTo]);

  const onReroll = async () => {
    setRolling(true);
    try {
      const ident = await finalize({ data: { rerollSeed: String(Date.now()) } });
      setIdentity(ident);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRolling(false);
    }
  };

  const flag = identity?.countryCode ? countryFlag(identity.countryCode) : "";

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <AnimatePresence mode="wait">
        {!identity ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary"
            />
            <p className="mt-6 text-sm text-muted-foreground">{t("welcome.summoning")}</p>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              key={identity.avatarUrl}
              initial={{ scale: 0.4, opacity: 0, filter: "blur(20px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ type: "spring", damping: 14, stiffness: 110 }}
              className="mx-auto"
            >
              <AvatarSvg src={identity.avatarUrl} size={176} alt={identity.displayName} />
            </motion.div>

            <motion.p
              initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground"
            >
              {t("welcome.title")}
            </motion.p>
            <motion.h1
              key={identity.displayName}
              initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55, type: "spring", damping: 18 }}
              className="mt-3 text-3xl sm:text-4xl font-black text-balance leading-tight"
            >
              {identity.displayName}
            </motion.h1>
            {(flag || identity.city) && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 0.85 }}
                transition={{ delay: 0.9 }}
                className="mt-2 text-sm text-muted-foreground"
              >
                {flag} {identity.city ?? identity.countryCode ?? ""}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-10 space-y-3"
            >
              {redirectTo ? (
                <a
                  href={redirectTo}
                  onClick={() => {
                    try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {}
                  }}
                  className="block w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-center"
                >
                  Continue →
                </a>
              ) : (
                <Link
                  to="/"
                  className="block w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-center"
                >
                  {t("welcome.cta")}
                </Link>
              )}
              <button
                onClick={onReroll}
                disabled={rolling}
                className="block w-full text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-60"
              >
                {rolling ? t("welcome.rerolling") : t("welcome.reroll")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

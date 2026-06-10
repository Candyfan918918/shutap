// /welcome — the alias reveal flow after auth. Order: ensure session → DOB → spin → reveal.
// The DOB step calls /auth-age-gate (server fn) before alias generation.
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getValidUserSession } from "@/lib/auth/get-valid-user";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { finalizeIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { generateAlias, claimAlias, type GeneratedAlias } from "@/lib/alias.functions";
import { verifyAge } from "@/lib/auth-age-gate.functions";
import { AvatarSvg } from "@/components/identity/AvatarSvg";
import { SlotReel, clickTone } from "@/components/identity/SlotReel";
import { UnderageBlock } from "@/components/gate/UnderageBlock";

const EMOJI_OPTIONS = ["🦊", "🦉", "🐙", "🦋", "🌙", "⚡", "🌸", "🔥", "🎭", "👁", "🪞", "⚖️"];

type Phase = "loading" | "dob" | "underage" | "spin" | "reveal" | "saving" | "done";

const MIN_BIRTH_YEAR = 1900;

function getAdultCutoffYear() {
  return new Date().getUTCFullYear() - 18;
}

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
  const submitAge = useServerFn(verifyAge);
  const claim = useServerFn(claimAlias);

  const [phase, setPhase] = useState<Phase>("loading");
  const [identity, setIdentity] = useState<IdentityPayload | null>(null);
  const [alias, setAlias] = useState<GeneratedAlias | null>(null);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [emoji, setEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [locks, setLocks] = useState({ n: false, e: false, c: false });
  const [busy, setBusy] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const latestAdultYear = getAdultCutoffYear();

  const [dobMonth, setDobMonth] = useState<number>(1);
  const [dobYear, setDobYear] = useState<number>(Math.max(MIN_BIRTH_YEAR, latestAdultYear - 7));

  // Resolve redirect destination from search or sessionStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("md.postAuthRedirect");
    setRedirectTo(redirectSearch || stored || null);
  }, [redirectSearch]);

  // Ensure session, finalize identity, then go to DOB step.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      console.log("[welcome] checking session…");
      const { session } = await getValidUserSession();
      if (!session) {
        console.warn("[welcome] no session — redirecting to /enter");
        navigate({ to: "/enter", search: { redirect: redirectSearch } });
        return;
      }
      console.log("[welcome] session ok, finalizing identity…");
      try {
        const ident = await finalize({ data: {} });
        if (cancelled) return;
        console.log("[welcome] finalizeIdentity ok", ident);
        setIdentity(ident);
        if (ident.locale) localStorage.setItem("md.locale", ident.locale);
        const aliasAlreadyClaimed = Boolean(ident.nationality && ident.emotion && ident.creature);
        if (ident.ageVerified && aliasAlreadyClaimed) {
          const dest = redirectSearch && redirectSearch.startsWith("/") && !redirectSearch.startsWith("//")
            ? redirectSearch
            : "/court";
          try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {/* noop */}
          window.location.replace(dest);
          return;
        }
        if (ident.ageVerified) {
          setPhase("spin");
          return;
        }
        setPhase("dob");
      } catch (e) {
        console.error("[welcome] finalizeIdentity failed", e);
        const msg = e instanceof Error ? e.message : "Couldn't finalize";
        setErrorMsg(`finalizeIdentity: ${msg}`);
        toast.error(msg);
      }
    })();
    return () => { cancelled = true; };
  }, [finalize, navigate, redirectSearch]);

  // DOB submit → call /auth-age-gate → either underage or start slot machine
  const onAgeSubmit = async () => {
    console.log("[welcome] DOB confirm clicked", { dobMonth, dobYear });
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await submitAge({ data: { dob_month: dobMonth, dob_year: dobYear } });
      console.log("[welcome] verifyAge response", res);
      if (res.error) {
        if (res.error === "age_gate_failed") {
          setPhase("underage");
          return;
        }
        setErrorMsg(`verifyAge: ${res.error}`);
        toast.error(res.error);
        return;
      }
      if (!res.data?.age_verified) {
        setPhase("underage");
        return;
      }
      setAlias(null);
      setLocks({ n: false, e: false, c: false });
      setPhase("spin");
    } catch (e) {
      console.error("[welcome] verifyAge threw", e);
      const msg = e instanceof Error ? e.message : "Couldn't verify. Try again.";
      setErrorMsg(`verifyAge: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Slot machine: simultaneous spin 2000ms, then lock L/M/R at 2000/2200/2400
  const lockTimers = useRef<number[]>([]);
  useEffect(() => {
    if (phase !== "spin") return;
    if (!alias) {
      console.log("[welcome] generateAlias…", { countryCode: identity?.countryCode });
      void fetchAlias({
        data: {
          countryCode: identity?.countryCode ?? undefined,
        },
      })
        .then((fresh) => {
          console.log("[welcome] generateAlias ok", fresh);
          setAlias(fresh);
        })
        .catch((e) => {
          console.error("[welcome] generateAlias failed", e);
          const msg = e instanceof Error ? e.message : "Couldn't assign your alias.";
          setErrorMsg(`generateAlias: ${msg}`);
          toast.error(msg);
          setPhase("dob");
        });
      return;
    }
    setLocks({ n: false, e: false, c: false });
    lockTimers.current.forEach((id) => window.clearTimeout(id));
    const t1 = window.setTimeout(() => { setLocks((l) => ({ ...l, e: true })); clickTone(440, 0.3); }, 2000);
    const t2 = window.setTimeout(() => { setLocks((l) => ({ ...l, n: true })); clickTone(460, 0.3); }, 2200);
    const t3 = window.setTimeout(() => { setLocks((l) => ({ ...l, c: true })); clickTone(480, 0.3); }, 2400);
    const t4 = window.setTimeout(() => setPhase("reveal"), 2800);
    lockTimers.current = [t1, t2, t3, t4];
    return () => { lockTimers.current.forEach((id) => window.clearTimeout(id)); };
  }, [phase, alias, fetchAlias, identity?.countryCode]);

  const onReroll = async () => {
    if (rerollUsed) return;
    setRerollUsed(true);
    setAlias(null);
    setLocks({ n: false, e: false, c: false });
    setPhase("spin");
    try {
      const fresh = await fetchAlias({
        data: {
          countryCode: identity?.countryCode ?? undefined,
        },
      });
      setAlias(fresh);
    } catch (e) {
      console.error("[welcome] reroll generateAlias failed", e);
      const msg = e instanceof Error ? e.message : "Couldn't assign your alias.";
      setErrorMsg(`generateAlias: ${msg}`);
      toast.error(msg);
      setPhase("reveal");
    }
  };

  const onConfirm = async () => {
    if (!alias || busy) return;
    console.log("[welcome] claimAlias…", alias);
    setBusy(true);
    setErrorMsg(null);
    setPhase("saving");
    try {
      const res = await claim({
        data: {
          nationality: alias.nationality,
          emotion: alias.emotion,
          creature: alias.creature,
          emoji,
          rerollUsed,
        },
      });
      console.log("[welcome] claimAlias result", res);
      if (!res.ok) {
        if (res.reason === "taken") {
          toast.message("Someone else just claimed that. Spinning again.");
          setAlias(null);
          setLocks({ n: false, e: false, c: false });
          setPhase("spin");
          return;
        }
        if (res.reason === "blocked") {
          setPhase("underage");
          return;
        }
        if (res.reason === "age_not_verified") {
          setErrorMsg("Age not verified yet.");
          setPhase("dob");
          return;
        }
        setErrorMsg(`claimAlias: ${res.message ?? "unknown"}`);
        toast.error(res.message ?? "Couldn't save");
        setPhase("reveal");
        return;
      }
      setPhase("done");
      const dest = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/court";
      try { sessionStorage.removeItem("md.postAuthRedirect"); } catch {/* noop */}
      setTimeout(() => { window.location.replace(dest); }, 600);
    } catch (e) {
      console.error("[welcome] claimAlias threw", e);
      const msg = e instanceof Error ? e.message : "Couldn't save";
      setErrorMsg(`claimAlias: ${msg}`);
      toast.error(msg);
      setPhase("reveal");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "underage") return <UnderageBlock />;

  const flag = identity?.countryCode ? countryFlag(identity.countryCode) : "";

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {phase === "loading" ? "One moment."
            : phase === "dob" ? "Before we go further."
            : phase === "spin" ? "The court is assigning your identity"
            : phase === "saving" ? "Sealing your identity"
            : "The court has spoken"}
        </p>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <p className="font-mono break-words">{errorMsg}</p>
            <button
              onClick={() => { setErrorMsg(null); if (phase === "saving") setPhase("reveal"); }}
              className="mt-1 underline text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Slot reels — present from spin onward */}
        {phase !== "dob" && phase !== "loading" && (
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-surface-elevated border border-border p-3">
            <SlotReel pool={alias?.reelPools.emotion} value={alias?.emotion} locked={locks.e} />
            <SlotReel pool={alias?.reelPools.nationality} value={alias?.nationality} locked={locks.n} />
            <SlotReel pool={alias?.reelPools.creature} value={alias?.creature} locked={locks.c} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "dob" && (
            <motion.div
              key="dob"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 space-y-3"
            >
              <p className="text-sm text-muted-foreground text-center">
                Shutap is for adults 18 and older.
              </p>
              <div className="flex gap-2">
                <select value={dobMonth} onChange={(e) => setDobMonth(parseInt(e.target.value, 10))}
                  className="flex-1 rounded-lg bg-surface-elevated border border-border px-2 py-2.5 text-sm">
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={dobYear} onChange={(e) => setDobYear(parseInt(e.target.value, 10))}
                  className="w-32 rounded-lg bg-surface-elevated border border-border px-2 py-2.5 text-sm">
                  {Array.from({ length: latestAdultYear - MIN_BIRTH_YEAR + 1 }, (_, i) => latestAdultYear - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button onClick={onAgeSubmit} disabled={busy}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50">
                {busy ? "Checking…" : "Confirm"}
              </button>
            </motion.div>
          )}

          {(phase === "reveal" || phase === "saving" || phase === "done") && alias && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">You are</p>
                <p className="mt-1 text-xl sm:text-2xl font-medium leading-tight">
                    {alias.emotion} {alias.nationality} {alias.creature}
                </p>
              </div>

              {identity && (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 14, stiffness: 110 }}
                  className="mx-auto"
                >
                  <AvatarSvg src={identity.avatarUrl} size={96} alt={identity.displayName} />
                  {(flag || identity.city) && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {flag} {identity.city ?? identity.countryCode ?? ""}
                    </p>
                  )}
                </motion.div>
              )}

              {/* 12-option emoji picker, single row */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Pick your mark</p>
                <div className="grid grid-cols-12 gap-1">
                  {EMOJI_OPTIONS.map((e) => (
                    <button key={e} onClick={() => setEmoji(e)}
                      disabled={phase !== "reveal"}
                      className={`aspect-square rounded-md text-base flex items-center justify-center transition ${
                        emoji === e
                          ? "bg-primary/20 border border-primary"
                          : "bg-surface-elevated border border-border hover:border-primary/50"
                      }`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={onConfirm} disabled={busy || phase !== "reveal"}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50">
                {phase === "saving" ? "Sealing…" : phase === "done" ? "✓" : "This is me →"}
              </button>

              {!rerollUsed && phase === "reveal" && (
                <button onClick={onReroll}
                  className="text-xs text-muted-foreground hover:text-foreground underline">
                  Re-roll (1 left)
                </button>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your alias is permanent. Your real name never appears here.
              </p>
            </motion.div>
          )}

          {phase === "spin" && (
            <motion.p
              key="spinning"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-6 text-center text-sm text-muted-foreground"
            >
              Hold. The reels are deciding.
            </motion.p>
          )}
        </AnimatePresence>

        {phase === "done" && redirectTo && (
          <Link to="/" className="sr-only">{t("welcome.cta")}</Link>
        )}
      </div>
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

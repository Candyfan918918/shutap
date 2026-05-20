import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/enter")({
  head: () => ({ meta: [{ title: "Enter — Shutap" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: EnterShell,
});

function EnterShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  return (
    <I18nProvider locale={locale}>
      <EnterPage />
    </I18nProvider>
  );
}

function EnterPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"idle" | "email" | "google" | "apple">("idle");

  // Persist intended destination so verify + welcome can resume it.
  useEffect(() => {
    if (redirectTo && typeof window !== "undefined") {
      try { sessionStorage.setItem("md.postAuthRedirect", redirectTo); } catch {}
    }
  }, [redirectTo]);

  // Already signed in? Skip to /welcome (preserving redirect).
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/welcome", search: redirectTo ? { redirect: redirectTo } : {} });
      }
    });
  }, [navigate, redirectTo]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy !== "idle" || !email.includes("@")) return;
    setBusy("email");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });
      if (error) throw error;
      sessionStorage.setItem("md.otpEmail", email);
      navigate({ to: "/enter/verify" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("rate")) toast.error(t("enter.rateLimited"));
      else toast.error(t("enter.failed"));
      setBusy("idle");
    }
  };

  const onOauth = async (provider: "google" | "apple") => {
    if (busy !== "idle") return;
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/welcome`,
      });
      if (result.error) {
        toast.error(t("enter.failed"));
        setBusy("idle");
      }
    } catch {
      toast.error(t("enter.failed"));
      setBusy("idle");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain flex flex-col">
      <header className="px-4 py-3">
        <Link to="/" className="text-sm text-muted-foreground">← {t("appName")}</Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-balance leading-tight">
            {t("enter.title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("enter.sub")}</p>

          <form onSubmit={onEmail} className="mt-8 space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("enter.emailPlaceholder")}
              className="w-full px-4 py-3.5 rounded-full bg-surface-elevated border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 text-base"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={busy !== "idle"}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold disabled:opacity-60"
            >
              {busy === "email" ? t("enter.sending") : t("enter.emailCta")}
            </motion.button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            <span>{t("enter.or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onOauth("google")}
              disabled={busy !== "idle"}
              className="w-full py-3 rounded-full bg-surface-elevated border border-border font-semibold text-sm disabled:opacity-60"
            >
              {busy === "google" ? "…" : `🔵  ${t("enter.google")}`}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onOauth("apple")}
              disabled={busy !== "idle"}
              className="w-full py-3 rounded-full bg-surface-elevated border border-border font-semibold text-sm disabled:opacity-60"
            >
              {busy === "apple" ? "…" : `🍎  ${t("enter.apple")}`}
            </motion.button>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            {t("enter.legal")}
          </p>
        </motion.div>
      </main>
    </div>
  );
}

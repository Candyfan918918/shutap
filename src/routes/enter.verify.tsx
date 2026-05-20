import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider, useT } from "@/lib/i18n/context";
import { detectBrowserLocale, isLocale, type Locale } from "@/lib/i18n";
import { OtpInput } from "@/components/auth/OtpInput";

export const Route = createFileRoute("/enter/verify")({
  head: () => ({ meta: [{ title: "Verify — Shutap" }] }),
  component: VerifyShell,
});

function VerifyShell() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
    setLocale(isLocale(stored) ? stored : detectBrowserLocale());
  }, []);
  return (
    <I18nProvider locale={locale}>
      <VerifyPage />
    </I18nProvider>
  );
}

function VerifyPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("md.otpEmail");
    if (!stored) navigate({ to: "/enter" });
    else setEmail(stored);
  }, [navigate]);

  const onComplete = async (code: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      sessionStorage.removeItem("md.otpEmail");
      const redirectTo = sessionStorage.getItem("md.postAuthRedirect") || undefined;
      navigate({ to: "/welcome", search: redirectTo ? { redirect: redirectTo } : {} });
    } catch {
      toast.error(t("verify.invalid"));
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await supabase.auth.signInWithOtp({ email });
      toast.success(t("verify.resend"));
    } catch {
      toast.error(t("enter.failed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grain flex flex-col">
      <header className="px-4 py-3">
        <Link to="/enter" className="text-sm text-muted-foreground">{t("verify.back")}</Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <h1 className="text-3xl font-black">{t("verify.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("verify.sub", { email })}
          </p>
          <div className="mt-8">
            <OtpInput onComplete={onComplete} disabled={busy} />
          </div>
          {busy && <p className="mt-4 text-xs text-muted-foreground">{t("verify.verifying")}</p>}
          <button
            onClick={onResend}
            disabled={resending}
            className="mt-8 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            {t("verify.resend")}
          </button>
        </motion.div>
      </main>
    </div>
  );
}

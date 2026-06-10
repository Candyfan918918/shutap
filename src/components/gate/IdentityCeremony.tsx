// Identity ceremony — the AUTH-ONLY soft gate. When an anonymous user tries
// a protected action (vote, react, comment), this overlay opens to collect
// sign-in. After successful sign-in we route to /welcome which owns DOB,
// alias spin, claim, and the post-onboarding redirect (single canonical flow).
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGateStore, type PendingAction } from "@/stores/gate";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const RESUME_KEY = "md.gate.resume";

function stashPending(p: PendingAction) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(p));
  } catch (e) {
    console.warn("[gate] could not stash pending action", e);
  }
}

export function IdentityCeremony() {
  const open = useGateStore((s) => s.open);
  const pending = useGateStore((s) => s.pending);
  const close = useGateStore((s) => s.close);

  if (!open || !pending) return null;
  return <AuthOverlay pending={pending} onClose={close} />;
}

function AuthOverlay({ pending, onClose }: { pending: PendingAction; onClose: () => void }) {
  // If a session already exists (user returned from OAuth redirect, or already
  // signed in elsewhere), close the overlay — GateRoot's resume listener will
  // route them through /welcome if onboarding is still incomplete.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        console.log("[gate] session present, closing overlay (resume handler takes over)");
        onClose();
      }
    });
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/70 pointer-events-auto"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-md bg-card border-t border-x border-border rounded-t-3xl pointer-events-auto overflow-hidden"
      >
        <p className="px-5 pt-4 pb-1 text-center text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
          The court is assigning your identity.
        </p>
        <div className="p-5 pt-2 space-y-3">
          <AuthCard pending={pending} />
        </div>
      </motion.div>
    </div>
  );
}

function AuthCard({ pending }: { pending: PendingAction }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"idle" | "email" | "google" | "apple">("idle");

  const stash = () => stashPending(pending);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy !== "idle" || !email.includes("@")) return;
    setBusy("email");
    try {
      stash();
      // Email magic link returns the user to /welcome so onboarding owns the
      // post-auth flow. The redirect param preserves where they came from.
      const redirectBack = `${window.location.pathname}${window.location.search}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/welcome?redirect=${encodeURIComponent(redirectBack)}`,
        },
      });
      if (error) throw error;
      toast.success("Check your email for the sign-in link.");
      setBusy("idle");
    } catch (err) {
      console.error("[gate] email OTP failed", err);
      toast.error(err instanceof Error ? err.message : "Couldn't send the link. Try again.");
      setBusy("idle");
    }
  };

  const onOauth = async (provider: "google" | "apple") => {
    if (busy !== "idle") return;
    setBusy(provider);
    try {
      stash();
      const redirectBack = `${window.location.pathname}${window.location.search}`;
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/welcome?redirect=${encodeURIComponent(redirectBack)}`,
      });
      if (result.error) {
        console.error("[gate] OAuth error", result.error);
        toast.error("Sign-in failed. Try again.");
        setBusy("idle");
      }
    } catch (err) {
      console.error("[gate] OAuth threw", err);
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Try again.");
      setBusy("idle");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <p className="text-sm font-medium">Continue to claim your identity.</p>
      <form onSubmit={onEmail} className="space-y-2">
        <input
          type="email" inputMode="email" autoComplete="email" required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy !== "idle" || !email.includes("@")}
          className="w-full rounded-full bg-primary text-primary-foreground font-medium text-sm py-2.5 disabled:opacity-50"
        >
          {busy === "email" ? "Sending…" : "Continue with email →"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex-1 h-px bg-border" /><span>or</span><div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onOauth("google")}
          disabled={busy !== "idle"}
          className="w-full py-2.5 rounded-full bg-background border border-border font-medium text-sm disabled:opacity-60"
        >
          {busy === "google" ? "…" : "🔵  Continue with Google"}
        </button>
        <button
          type="button"
          onClick={() => onOauth("apple")}
          disabled={busy !== "idle"}
          className="w-full py-2.5 rounded-full bg-background border border-border font-medium text-sm disabled:opacity-60"
        >
          {busy === "apple" ? "…" : "🍎  Continue with Apple"}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Zero real names exposed. Your email is never shown on the court.
      </p>
    </div>
  );
}

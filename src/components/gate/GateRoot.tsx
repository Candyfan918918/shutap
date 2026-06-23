// Global mount point for the IdentityCeremony auth overlay AND the post-auth
// resume handler. The overlay is auth-only; if a signed-in user lands here
// with onboarding incomplete, we route them to /welcome (the single
// canonical onboarding surface).
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useGateStore, type PendingAction } from "@/stores/gate";
import { IdentityCeremony, RESUME_KEY } from "@/components/gate/IdentityCeremony";

export function GateRoot() {
  const open = useGateStore((s) => s.open);
  const enqueue = useGateStore((s) => s.enqueue);

  useEffect(() => {
    let active = true;

    const tryResume = async (hasSession: boolean) => {
      if (!hasSession) return;
      let parsed: PendingAction | null = null;
      try {
        const raw = sessionStorage.getItem(RESUME_KEY);
        if (raw) parsed = JSON.parse(raw) as PendingAction;
      } catch (e) {
        console.warn("[gate] could not parse resume key", e);
      }

      // Avoid the /welcome page itself triggering its own redirect loop.
      const onWelcome = typeof window !== "undefined" && window.location.pathname === "/welcome";
      if (onWelcome) return;

      // Check whether onboarding is complete; if not, send them to /welcome.
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("age_verified, nationality, emotion, creature")
          .eq("id", user.user.id)
          .maybeSingle();
        if (error) {
          console.warn("[gate] onboarding check deferred", error.message);
          return;
        }

        const aliasClaimed = Boolean(profile?.nationality && profile?.emotion && profile?.creature);
        const ageVerified = Boolean(profile?.age_verified);

        if (!ageVerified || !aliasClaimed) {
          const here = `${window.location.pathname}${window.location.search}`;
          console.log("[gate] onboarding incomplete, sending to /welcome");
          window.location.assign(`/welcome?redirect=${encodeURIComponent(here)}`);
          return;
        }

        // Fully onboarded — replay the pending action if there is one.
        if (parsed) {
          try { sessionStorage.removeItem(RESUME_KEY); } catch { /* noop */ }
          enqueue(parsed);
        }
      } catch (e) {
        console.error("[gate] resume check failed", e);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void tryResume(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        void tryResume(!!session);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [enqueue]);

  return (
    <AnimatePresence>
      {open && <IdentityCeremony key="ceremony" />}
    </AnimatePresence>
  );
}

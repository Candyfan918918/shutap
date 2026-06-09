// Global mount point for the IdentityCeremony. Lives at the router root so any
// component on any route can call useGateStore.enqueue(...) and the ceremony
// will play — and replay the pending action after sign-in.
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
    const tryResume = (hasSession: boolean) => {
      if (!hasSession) return;
      try {
        const raw = sessionStorage.getItem(RESUME_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PendingAction;
        sessionStorage.removeItem(RESUME_KEY);
        enqueue(parsed);
      } catch {/* silent */}
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      tryResume(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      tryResume(!!session);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [enqueue]);

  return (
    <AnimatePresence>
      {open && <IdentityCeremony key="ceremony" />}
    </AnimatePresence>
  );
}

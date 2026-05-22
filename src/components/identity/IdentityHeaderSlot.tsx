// Header slot: shows the user's IdentityBadge if signed-in, otherwise a
// compact "Enter" pill. Uses the browser supabase session as the source of
// truth and lazily fetches identity via the protected server fn.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { IdentityBadge } from "./IdentityBadge";
import { useT } from "@/lib/i18n/context";

export function IdentityHeaderSlot() {
  const { t } = useT();
  const navigate = useNavigate();
  const fetchIdentity = useServerFn(getMyIdentity);
  const [identity, setIdentity] = useState<IdentityPayload | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (signedIn: boolean) => {
      if (!signedIn) {
        if (!cancelled) {
          setIdentity(null);
          setHasSession(false);
        }
        return;
      }
      if (!cancelled) setHasSession(true);
      try {
        const ident = await fetchIdentity();
        if (!cancelled) setIdentity(ident);
      } catch {
        // 401 or transient — leave identity null; badge falls back to Enter
      }
    };

    void supabase.auth.getSession().then(({ data }) => load(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      void load(!!session);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchIdentity]);

  if (hasSession && identity) {
    return (
      <IdentityBadge
        displayName={identity.displayName}
        avatarUrl={identity.avatarUrl}
        onClick={() => navigate({ to: "/me" })}
      />
    );
  }
  if (hasSession === true && !identity) {
    // Signed in but identity not finalized yet — push to /welcome to finish onboarding
    return (
      <Link
        to="/welcome"
        search={{ redirect: undefined }}
        className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition"
      >
        ✨ {t("nav.finishOnboarding")}
      </Link>
    );
  }
  return (
    <Link
      to="/enter"
      className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
    >
      {t("nav.enter")} →
    </Link>
  );
}

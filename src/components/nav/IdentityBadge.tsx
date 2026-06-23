// Floating identity badge mounted globally in __root.tsx. Replaces traditional
// nav: signed-in users see their alias avatar + dropdown; signed-out users see
// an "Enter" pill. Follows the Bench voice — declarative, no exclamation marks.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { AvatarSvg } from "@/components/identity/AvatarSvg";

type MenuLink = { to: string; label: string; emoji: string };

const USER_LINKS: MenuLink[] = [
  { to: "/me", label: "My profile", emoji: "👤" },
  { to: "/me/posts", label: "My posts", emoji: "📝" },
  { to: "/profile/scans", label: "My scans", emoji: "🔍" },
  { to: "/compose", label: "New post", emoji: "✨" },
  { to: "/settings", label: "Settings", emoji: "⚙️" },
];

function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

export function IdentityBadge() {
  const navigate = useNavigate();
  const fetchIdentity = useServerFn(getMyIdentity);
  const [identity, setIdentity] = useState<IdentityPayload | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    let cancelled = false;
    const load = async (signedIn: boolean) => {
      if (!signedIn) {
        if (!cancelled) { setIdentity(null); setHasSession(false); }
        return;
      }
      try {
        const ident = await fetchIdentity();
        if (!cancelled) { setIdentity(ident); setHasSession(true); }
      } catch { /* ignore */ }
    };
    void supabase.auth.getSession().then(({ data }) => load(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void load(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [fetchIdentity]);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (hasSession === null) return null;

  if (hasSession && identity) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-background/85 backdrop-blur border border-border max-w-[200px] hover:border-primary/50 transition shadow-sm"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <AvatarSvg src={identity.avatarUrl} size={26} className="shadow-none" alt="" />
          <span className="text-xs font-medium truncate hidden sm:inline">{identity.displayName}</span>
          <span className="text-[10px] text-muted-foreground">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg z-50">
            <div className="px-3 py-2 border-b border-border mb-1">
              <div className="text-xs font-medium truncate">{identity.displayName}</div>
              <div className="text-[10px] text-muted-foreground">Signed in</div>
            </div>
            {USER_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm hover:bg-surface-elevated transition"
              >
                <span className="mr-2">{l.emoji}</span>{l.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 mt-1 rounded-lg text-sm hover:bg-surface-elevated transition border-t border-border text-muted-foreground"
            >
              🚪 Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  if (hasSession === true && !identity) {
    return (
      <Link
        to="/welcome"
        search={{ redirect: undefined }}
        className="text-xs px-3 py-1.5 rounded-full bg-background/85 backdrop-blur border border-border hover:border-primary/50 transition shadow-sm"
      >
        ✨ Finish onboarding
      </Link>
    );
  }

  return (
    <Link
      to="/enter"
      search={{ redirect: undefined }}
      className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium shadow-sm"
    >
      Enter →
    </Link>
  );
}

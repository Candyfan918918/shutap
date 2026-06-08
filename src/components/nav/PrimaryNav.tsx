// Primary site navigation: logo, primary links (desktop), user menu, language
// switcher, and a mobile sheet that exposes every feature.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity, type IdentityPayload } from "@/lib/identity.functions";
import { AvatarSvg } from "@/components/identity/AvatarSvg";
import { useT } from "@/lib/i18n/context";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import shutapIcon from "@/assets/shutap-icon.svg.asset.json";
import shutapLogoClear from "@/assets/shutap-logo-clear.svg.asset.json";

type PrimaryLink = {
  to: string;
  label: string;
  emoji: string;
  highlight?: boolean;
};

const PRIMARY_LINKS: PrimaryLink[] = [
  { to: "/court", label: "Court", emoji: "👑", highlight: true },
  { to: "/spill", label: "Spill", emoji: "🫖" },
  { to: "/scan/start", label: "Scan", emoji: "🔍" },
  { to: "/friends", label: "Friends", emoji: "👯" },
];

const USER_LINKS: PrimaryLink[] = [
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

export function PrimaryNav({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
}) {
  const { t } = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useClickOutside<HTMLDivElement>(() => setLangOpen(false));

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/75 border-b border-border">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center shrink-0" aria-label={t("appName")}>
          <img src={shutapLogoClear.url} alt={t("appName")} className="hidden sm:block h-7 w-auto" />
          <img src={shutapIcon.url} alt={t("appName")} className="sm:hidden h-7 w-auto" />
        </Link>

        {/* Desktop primary links */}
        <nav className="hidden md:flex items-center gap-1">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                l.highlight
                  ? "text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/40 hover:border-primary transition font-semibold"
                  : "text-xs px-3 py-1.5 rounded-full border border-transparent hover:border-border hover:bg-surface-elevated transition font-medium text-muted-foreground hover:text-foreground"
              }
              activeProps={{ className: "text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-surface-elevated transition font-semibold" }}
            >
              {l.emoji} {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <UserMenu />

          <div className="relative hidden sm:block" ref={langRef}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition"
              aria-label={t("nav.language")}
            >
              🌐 {LOCALE_LABELS[locale]}
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-popover p-1 shadow-xl z-50">
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l}
                    onClick={() => { onLocaleChange(l); setLangOpen(false); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-elevated transition ${l === locale ? "text-primary" : ""}`}
                  >
                    {LOCALE_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <nav className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-2 gap-2">
            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="text-sm px-3 py-2.5 rounded-xl bg-surface-elevated border border-border hover:border-primary/50 transition font-medium"
              >
                {l.emoji} {l.label}
              </Link>
            ))}
          </nav>
          <div className="mx-auto max-w-6xl px-4 pb-3 sm:hidden">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 mb-1.5 px-1">
              {t("nav.language")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => { onLocaleChange(l); setMobileOpen(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${l === locale ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function UserMenu() {
  const { t } = useT();
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
      if (!cancelled) setHasSession(true);
      try {
        const ident = await fetchIdentity();
        if (!cancelled) setIdentity(ident);
      } catch { /* ignore */ }
    };
    void supabase.auth.getSession().then(({ data }) => load(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      void load(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [fetchIdentity]);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (hasSession && identity) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-surface-elevated/80 border border-border max-w-[180px] hover:border-primary/50 transition"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <AvatarSvg src={identity.avatarUrl} size={28} className="shadow-none" alt="" />
          <span className="text-xs font-semibold truncate hidden sm:inline">{identity.displayName}</span>
          <span className="text-[10px] text-muted-foreground">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-xl z-50">
            <div className="px-3 py-2 border-b border-border mb-1">
              <div className="text-xs font-semibold truncate">{identity.displayName}</div>
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
        className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/50 transition"
      >
        ✨ {t("nav.finishOnboarding")}
      </Link>
    );
  }

  return (
    <Link
      to="/enter"
      search={{ redirect: undefined }}
      className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
    >
      {t("nav.enter")} →
    </Link>
  );
}

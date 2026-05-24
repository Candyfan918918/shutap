// Minimal navigation: Home, Court, Profile + Spill CTA. Mobile sheet matches.
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

type PrimaryLink = { to: string; label: string; emoji: string };

const PRIMARY_LINKS: PrimaryLink[] = [
  { to: "/", label: "Home", emoji: "🏠" },
  { to: "/court", label: "Court", emoji: "⚖️" },
  { to: "/me", label: "Profile", emoji: "👤" },
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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/60">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center text-base shadow-sm">
            👀
          </div>
          <span className="font-display font-bold tracking-tight text-lg">shutap</span>
        </Link>

        {/* Desktop primary links — only 3 */}
        <nav className="hidden md:flex items-center gap-1">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm px-4 py-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface transition font-medium"
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "text-sm px-4 py-2 rounded-full bg-surface text-foreground font-semibold" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/spill"
            className="hidden sm:inline-flex text-sm px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold shadow-soft hover:scale-[1.02] active:scale-95 transition"
          >
            ☕ Spill
          </Link>

          <UserMenu />

          <div className="relative hidden md:block" ref={langRef}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="text-xs px-3 py-2 rounded-full hover:bg-surface transition text-muted-foreground"
              aria-label={t("nav.language")}
            >
              🌐
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-border bg-popover p-1 shadow-soft z-50">
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l}
                    onClick={() => { onLocaleChange(l); setLangOpen(false); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-xl hover:bg-surface transition ${l === locale ? "text-primary font-semibold" : ""}`}
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
            className="md:hidden h-10 w-10 grid place-items-center rounded-full hover:bg-surface transition"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <nav className="mx-auto max-w-5xl px-5 py-4 flex flex-col gap-1">
            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="text-base px-4 py-3 rounded-2xl hover:bg-surface transition font-medium"
              >
                <span className="mr-3">{l.emoji}</span>{l.label}
              </Link>
            ))}
            <Link
              to="/spill"
              onClick={() => setMobileOpen(false)}
              className="mt-2 text-base px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-center"
            >
              ☕ Spill the tea
            </Link>
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
              {SUPPORTED_LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => { onLocaleChange(l); setMobileOpen(false); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${l === locale ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </nav>
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
          className="inline-flex items-center gap-2 p-1 pr-1 rounded-full hover:bg-surface transition"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <AvatarSvg src={identity.avatarUrl} size={32} className="shadow-none" alt="" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-popover p-2 shadow-soft z-50">
            <div className="px-3 py-2 mb-1">
              <div className="text-sm font-bold truncate">{identity.displayName}</div>
              <div className="text-[11px] text-muted-foreground">Signed in</div>
            </div>
            <Link to="/me" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm hover:bg-surface transition">
              👤 My profile
            </Link>
            <Link to="/me/posts" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm hover:bg-surface transition">
              📝 My posts
            </Link>
            <Link to="/settings" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm hover:bg-surface transition">
              ⚙️ Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 mt-1 rounded-xl text-sm hover:bg-surface transition border-t border-border text-muted-foreground"
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
        className="text-xs px-4 py-2 rounded-full bg-surface border border-border hover:border-primary/50 transition"
      >
        ✨ Finish setup
      </Link>
    );
  }

  return (
    <Link
      to="/enter"
      search={{ redirect: undefined }}
      className="text-sm px-4 py-2 rounded-full border border-border hover:border-primary/60 hover:bg-surface transition font-medium"
    >
      {t("nav.enter")}
    </Link>
  );
}

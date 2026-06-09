// Settings layout — left nav on desktop, top bar on mobile.
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

const SECTIONS = [
  { to: "/settings/account", emoji: "👤", label: "Account" },
  { to: "/settings/identity", emoji: "✨", label: "Identity" },
  { to: "/settings/privacy", emoji: "🔒", label: "Privacy" },
  { to: "/settings/notifications", emoji: "🔔", label: "Notifications" },
  { to: "/settings/language", emoji: "🌍", label: "Language" },
  { to: "/settings/safety", emoji: "🛡️", label: "Safety" },
  { to: "/settings/data", emoji: "📦", label: "Data" },
] as const;

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
  head: () => ({ meta: [{ title: "Settings" }] }),
});

function SettingsLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85  border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/me" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-medium">Settings</div>
          <span className="w-6" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <nav className="md:sticky md:top-20 self-start">
          <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar md:overflow-visible">
            {SECTIONS.map((s) => {
              const active = pathname === s.to;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className={`shrink-0 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-surface-elevated text-muted-foreground"
                  }`}
                >
                  {s.emoji} {s.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </main>
    </div>
  );
}

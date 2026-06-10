// Shutap home — feature hub.
// Marketing-light landing presenting every product surface as a Bench-voiced tile.
// Signed-in users keep the same hub; tiles route into the authenticated app.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import shutapIcon from "@/assets/shutap-favicon-32.png.asset.json";
import shutapLogo from "@/assets/shutap-logo-light.png.asset.json";

export const Route = createFileRoute("/")({
  component: HubPage,
  head: () => ({
    meta: [
      { title: "Shutap — Relationship Court™" },
      {
        name: "description",
        content:
          "The internet decides. Read the case, drop the verdict. Every surface, one place.",
      },
      { property: "og:title", content: "Shutap — Relationship Court™" },
      {
        property: "og:description",
        content: "Court. Stream. Hall of Fame. Scan. Spill. One bench.",
      },
      { property: "og:type", content: "website" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm text-c-text-2">The bench stepped out.</p>
      <p className="text-xs text-c-text-3 break-words">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm"
      >
        Call it back
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-c-text-2 text-sm">
      Nothing on the docket.
    </div>
  ),
});

type Feature = {
  to: string;
  icon: string;
  label: string;
  tag: string;
  blurb: string;
  tint: "pink" | "teal" | "amber" | "purple" | "coral" | "gold";
  cta: string;
  requiresAuth?: boolean;
};

const FEATURES: Feature[] = [
  {
    to: "/court",
    icon: "⚖️",
    label: "Court",
    tag: "Live trial",
    blurb: "The case is open. The jury is the internet. The verdict moves in real time.",
    tint: "gold",
    cta: "Enter the court",
  },
  {
    to: "/stream",
    icon: "📜",
    label: "Stream",
    tag: "Stories, unfiltered",
    blurb: "What people are saying, told the way they said it. No tabs. No filters. Just the room.",
    tint: "teal",
    cta: "Open the stream",
    requiresAuth: true,
  },
  {
    to: "/hof",
    icon: "👑",
    label: "Hall of Fame",
    tag: "Greatest moments",
    blurb: "The verdicts that shook the room. The stories that landed. The judges who were right.",
    tint: "purple",
    cta: "Walk the hall",
  },
  {
    to: "/spill",
    icon: "💬",
    label: "Spill",
    tag: "Bring a case",
    blurb: "Type it out, voice it out. The Bench helps you shape it. Then the room decides.",
    tint: "pink",
    cta: "Drop the case",
    requiresAuth: true,
  },
  {
    to: "/scan",
    icon: "🔍",
    label: "Scan",
    tag: "Pattern check",
    blurb: "Answer a few. Get a read on the dynamic. The Bench does not flatter.",
    tint: "coral",
    cta: "Run the scan",
    requiresAuth: true,
  },
  {
    to: "/friends",
    icon: "👥",
    label: "Friends",
    tag: "Your circle",
    blurb: "The people who get the receipts. Private. Aliased. Yours.",
    tint: "amber",
    cta: "See the circle",
    requiresAuth: true,
  },
];

function HubPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      {/* TOP CHROME */}
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <img src={shutapLogo.url} alt="Shutap" className="hidden sm:block h-6 w-auto" />
          <img src={shutapIcon.url} alt="Shutap" className="sm:hidden h-6 w-auto" />
          <div className="flex-1" />
          {authed === true ? (
            <Link
              to="/stream"
              className="text-xs px-3 py-1.5 rounded-full bg-c-text-1 text-white font-medium"
            >
              Open stream →
            </Link>
          ) : authed === false ? (
            <Link
              to="/enter"
              className="text-xs px-3 py-1.5 rounded-full bg-c-text-1 text-white font-medium"
            >
              Step in
            </Link>
          ) : (
            <span className="h-7 w-20" aria-hidden />
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-surface-3 bg-c-surface">
        {/* HERO */}
        <section className="hero-dark hub-hero">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hub-hero__crown">👑</div>
          <div className="hub-hero__tag">Relationship Court™</div>
          <h1 className="hub-hero__title">The bench is in session.</h1>
          <p className="hub-hero__sub">
            Every surface, one place. Pick a door.
          </p>
        </section>

        {/* FEATURE GRID */}
        <section className="px-3.5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <FeatureTile key={f.to} f={f} authed={authed} />
          ))}
        </section>

        {/* QUIET LINE */}
        <section className="px-4 pt-2 pb-6 text-center">
          <p className="text-[11px] text-c-text-3">
            Zero real names exposed. The Bench is the only one keeping score.
          </p>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-8 text-center text-[11px] text-c-text-3 space-y-1">
        <p>Real stories. Real opinions. Not legal or therapeutic advice.</p>
        <p>Made with chaos, worldwide.</p>
      </footer>
    </div>
  );
}

function FeatureTile({ f, authed }: { f: Feature; authed: boolean | null }) {
  const tintMap: Record<Feature["tint"], { bar: string; icon: string; tagText: string }> = {
    pink:   { bar: "bg-c-pink-soft",   icon: "bg-c-pink-soft text-c-pink-ink",     tagText: "text-c-pink-ink" },
    teal:   { bar: "bg-c-teal-soft",   icon: "bg-c-teal-soft text-c-teal-deep",    tagText: "text-c-teal-deep" },
    amber:  { bar: "bg-c-amber-soft",  icon: "bg-c-amber-soft text-c-amber-deep",  tagText: "text-c-amber-deep" },
    purple: { bar: "bg-c-purple-soft", icon: "bg-c-purple-soft text-c-purple-deep",tagText: "text-c-purple-deep" },
    coral:  { bar: "bg-c-coral-soft",  icon: "bg-c-coral-soft text-c-coral-deep",  tagText: "text-c-coral-deep" },
    gold:   { bar: "bg-c-amber-soft",  icon: "bg-c-amber-soft text-c-amber-deep",  tagText: "text-c-amber-deep" },
  };
  const t = tintMap[f.tint];
  const needsAuth = f.requiresAuth && authed === false;
  const dest = needsAuth ? "/enter" : f.to;

  return (
    <Link
      to={dest}
      className="group relative rounded-2xl border border-c-surface-3 bg-white p-4 flex flex-col gap-3 hover:border-c-border transition overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.bar}`} aria-hidden />
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl ${t.icon} flex items-center justify-center text-lg`}>
          {f.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-medium text-c-text-3">
            {f.tag}
          </div>
          <div className="text-base font-medium text-c-text-1 leading-tight">{f.label}</div>
        </div>
      </div>
      <p className="text-[13px] text-c-text-2 leading-snug">{f.blurb}</p>
      <div className={`text-[12px] font-medium ${t.tagText} flex items-center gap-1.5 mt-auto`}>
        {needsAuth ? "Step in first" : f.cta}
        <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

// Landing page — embeds the full Court, Story Stream, and Hall of Fame
// page bodies so visitors browse the live product before signing in.
// Watching is free. Every engagement action gates on sign-in.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGateStore } from "@/stores/gate";
import { useQuery } from "@tanstack/react-query";
import { CourtBody } from "@/components/sections/CourtBody";
import { StreamBody } from "@/components/sections/StreamBody";
import { HofBody } from "@/components/sections/HofBody";
import shutapIcon from "@/assets/shutap-favicon-32.png.asset.json";
import shutapLogo from "@/assets/shutap-logo-light.png.asset.json";

export const Route = createFileRoute("/")({
  component: AnonymousCourt,
  head: () => ({
    meta: [
      { title: "Shutap — 👑 Relationship Court™" },
      {
        name: "description",
        content:
          "The internet decides. Read the case, watch the verdict bar move in real time. Zero real names exposed.",
      },
      { property: "og:title", content: "Shutap — Relationship Court™" },
      { property: "og:description", content: "Watch the world decide. Zero real names exposed." },
      { property: "og:type", content: "website" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-4">
      <p className="text-sm text-muted-foreground">The bench is unavailable.</p>
      <p className="text-xs text-muted-foreground/70 break-words">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md border border-c-border bg-c-surface-2 text-c-text-1 text-sm font-medium hover:bg-c-surface-3 transition"
      >
        Try again
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-sm text-muted-foreground">Nothing on the docket.</p>
    </div>
  ),
});

function AnonymousCourt() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const gateOpen = useGateStore((s) => s.open);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const go = (to: "/spill" | "/scan" | "/court") => {
    if (authed) navigate({ to });
    else navigate({ to: "/enter", search: { redirect: to } });
  };

  const fetchGlobal = useServerFn(pingTally);
  const globalQ = useQuery({
    queryKey: ["landing", "global-verdicts"],
    queryFn: () => fetchGlobal(),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-16">
      <TopChrome authed={authed} />
      <TrustSignalBar total={globalQ.data?.total ?? null} />

      <motion.main
        animate={gateOpen ? { filter: "blur(4px)", y: 40 } : { filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-border bg-c-surface"
      >
        {/* Global landing hero */}
        <section className="hero-dark hub-hero">
          <div className="hero-dark__orb hero-dark__orb--tr" />
          <div className="hero-dark__orb hero-dark__orb--bl" />
          <div className="hub-hero__crown">👑</div>
          <div className="hub-hero__tag">Relationship Court™</div>
          <h1 className="hub-hero__title">Where the human decides.</h1>
          <p className="hub-hero__sub">Real cases. Real verdicts. Zero real names.</p>
        </section>

        {/* THE COURT — full embed of /court */}
        <CourtBody />
        <div className="px-3.5 pt-1 pb-6">
          <Link
            to="/court"
            className="block w-full text-center rounded-2xl border border-c-pink-border bg-c-pink-soft px-4 py-3 text-sm font-medium text-c-pink-deep hover:brightness-95 transition"
          >
            ⚖️ Open the full Court →
          </Link>
        </div>

        {/* STORY STREAM — full embed of /stream */}
        <StreamBody />
        <div className="px-3.5 pt-1 pb-6">
          <Link
            to="/stream"
            className="block w-full text-center rounded-2xl border border-c-teal-border bg-c-teal-soft px-4 py-3 text-sm font-medium text-c-teal-deep hover:brightness-95 transition"
          >
            🌊 Browse the full Story Stream →
          </Link>
        </div>

        {/* HALL OF FAME — full embed of /hof */}
        <HofBody />
        <div className="px-3.5 pt-3 pb-6">
          <Link
            to="/hof"
            className="block w-full text-center rounded-2xl border border-c-purple-border bg-c-purple-soft px-4 py-3 text-sm font-medium text-c-purple-deep hover:brightness-95 transition"
          >
            🏆 Browse the full Hall of Fame →
          </Link>
        </div>

        {/* FINAL CTA */}
        <div className="px-3.5 pb-8 pt-2">
          <FinalCTA onGo={go} />
        </div>
      </motion.main>

      <footer className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-8 text-center text-[11px] text-c-text-3 space-y-1">
        <p>Real stories. Real opinions. Not legal or therapeutic advice.</p>
        <p>Made with chaos, worldwide.</p>
      </footer>
    </div>
  );
}

function TrustSignalBar({ total }: { total: number | null }) {
  const [display, setDisplay] = useState<number | null>(total);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (total == null) return;
    if (last.current == null) { last.current = total; setDisplay(total); return; }
    const from = last.current; const to = total;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      setDisplay(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else last.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div className="w-full bg-c-surface-2 border-b border-c-surface-3">
      <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-1.5 flex items-center justify-between text-[11px] text-c-text-2 font-normal">
        <span className="flex items-center gap-1.5">
          <span className="relative inline-block h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-c-teal animate-ping opacity-75" />
            <span className="absolute inset-0 rounded-full bg-c-teal" />
          </span>
          <span>
            <span className="font-medium text-c-text-1 tabular-nums">
              {display != null ? display.toLocaleString() : "—"}
            </span>{" "}
            verdicts cast
          </span>
        </span>
        <span className="text-c-text-3">Zero real names exposed.</span>
      </div>
    </div>
  );
}

function TopChrome({ authed }: { authed: boolean | null }) {
  return (
    <header className="sticky top-0 z-40 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
      <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <img src={shutapLogo.url} alt="Shutap" className="hidden sm:block h-6 w-auto" />
          <img src={shutapIcon.url} alt="Shutap" className="sm:hidden h-6 w-auto" />
        </div>
        <span className="text-[11px] text-c-text-3 italic hidden sm:inline">
          {authed ? "The bench remembers you." : "The bench does not check IDs at the door."}
        </span>
      </div>
    </header>
  );
}

function FinalCTA({ onGo }: { onGo: (to: "/spill" | "/scan" | "/court") => void }) {
  const purple = "oklch(0.68 0.18 295)";
  return (
    <section
      className="rounded-3xl bg-surface-elevated p-8 text-center space-y-6"
      style={{ borderColor: purple, borderWidth: 0.5, borderStyle: "solid" }}
    >
      <div className="space-y-3">
        <p className="text-2xl sm:text-3xl font-medium text-balance">
          The bench is waiting on you.
        </p>
        <p className="text-sm text-muted-foreground text-balance">
          No name. No photo. An alias and a verdict. That is the price of entry.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-left">
        <button
          onClick={() => onGo("/spill")}
          className="group rounded-2xl border border-c-pink-border bg-c-pink-soft p-4 hover:brightness-95 transition"
        >
          <div className="text-[10px] uppercase tracking-wider font-medium text-c-pink-ink/80">
            Bring a case
          </div>
          <div className="mt-1 text-base font-medium text-c-pink-ink">
            Spill yours →
          </div>
          <p className="mt-2 text-xs text-c-pink-ink/80 leading-snug">
            Type it out. Voice it out. The bench shapes it. The room rules.
          </p>
        </button>
        <button
          onClick={() => onGo("/scan")}
          className="group rounded-2xl border border-c-coral-border bg-c-coral-soft p-4 hover:brightness-95 transition"
        >
          <div className="text-[10px] uppercase tracking-wider font-medium text-c-coral-deep/80">
            Read the dynamic
          </div>
          <div className="mt-1 text-base font-medium text-c-coral-deep">
            Run the scan →
          </div>
          <p className="mt-2 text-xs text-c-coral-deep/80 leading-snug">
            Answer a few. Get a read. The bench does not flatter.
          </p>
        </button>
      </div>

      <button
        onClick={() => onGo("/court")}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
      >
        Or just step in and watch the court.
      </button>
    </section>
  );
}

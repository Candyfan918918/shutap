// Story Stream route — wraps the shared <StreamBody /> with sticky header,
// alias pill, and the floating Bench chatbot menu (replaces nav).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { StreamBody } from "@/components/sections/StreamBody";

export const Route = createFileRoute("/stream")({
  component: StreamPage,
  head: () => ({
    meta: [
      { title: "Shutap — your story stream" },
      { name: "description", content: "Real anonymous stories. One stream. The bench voice." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm text-c-text-2">The stream is between stories.</p>
      <p className="text-xs text-c-text-3 break-words">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm">
        Reload
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-c-text-2 text-sm">Nothing on the docket.</div>
  ),
});

function useAuthed() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setAuthed(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return authed;
}

function StreamPage() {
  const authed = useAuthed();
  const fetchMe = useServerFn(getMyProfile);
  const meQ = useQuery({
    queryKey: ["me", "stream-header"],
    enabled: !!authed,
    queryFn: () => (fetchMe as unknown as () => Promise<Record<string, unknown> | null>)(),
    staleTime: 60_000,
  });

  const me = meQ.data;
  const aliasEmoji = (me?.emoji as string | undefined) ?? "🦉";
  const aliasName = (me?.nickname as string | undefined) ?? "Anonymous Juror";

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-medium tracking-tight">
            shut<span className="text-c-pink-deep">ap</span>
          </Link>
          {authed ? (
            <Link to="/me" className="alias-pill">
              <span className="text-base leading-none">{aliasEmoji}</span>
              <span className="text-c-pink-ink">{aliasName}</span>
            </Link>
          ) : (
            <Link to="/enter" className="alias-pill">
              <span className="text-base leading-none">👋</span>
              <span className="text-c-pink-ink">Step inside</span>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl border-x border-c-border pb-32">
        <StreamBody />
        <BenchPillMenu />
      </main>
    </div>
  );
}

function BenchPillMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items: Array<{ to: "/spill" | "/court" | "/scan" | "/stream" | "/hof"; emoji: string; label: string; sub: string; cls: string }> = [
    { to: "/spill",  emoji: "✍️", label: "Spill",        sub: "drop a story",         cls: "bg-c-pink-soft text-c-pink-ink border-c-pink-border" },
    { to: "/court",  emoji: "⚖️", label: "Court",        sub: "cast verdicts",        cls: "bg-c-teal-soft text-c-teal-deep border-c-teal-border" },
    { to: "/scan",   emoji: "🧠", label: "Scan",         sub: "read the room",        cls: "bg-c-purple-soft text-c-purple-deep border-c-purple-border" },
    { to: "/stream", emoji: "🌊", label: "Story Stream", sub: "the feed",             cls: "bg-c-amber-soft text-c-amber-deep border-c-amber-border" },
    { to: "/hof",    emoji: "🏆", label: "Hall of Fame", sub: "the legends",          cls: "bg-c-coral-soft text-c-coral-deep border-c-coral-border" },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-2xl px-3 pb-3">
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto"
            />
            <div className="relative pointer-events-auto mb-2 grid grid-cols-2 gap-2 rounded-3xl border border-c-surface-3 bg-c-surface p-2 shadow-2xl">
              {items.map((it) => (
                <Link
                  key={it.label}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left ${it.cls}`}
                >
                  <span className="text-xl leading-none">{it.emoji}</span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{it.label}</span>
                    <span className="block text-[11px] opacity-80">{it.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="chatbot-pill pointer-events-auto w-full justify-center italic"
        >
          {open ? "Close" : "Ask The Bench…"}
        </button>
      </div>
    </div>
  );
}

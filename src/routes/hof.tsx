// Hall of Fame route — wraps the shared <HofBody /> with page chrome.
import { createFileRoute, Link } from "@tanstack/react-router";
import { HofBody } from "@/components/sections/HofBody";

export const Route = createFileRoute("/hof")({
  component: HofPage,
  head: () => ({
    meta: [
      { title: "Hall of Fame — Shutap" },
      { name: "description", content: "Court verdicts that shook the platform. Stories that resonated with thousands. The judges who got it right." },
      { property: "og:title", content: "Hall of Fame — Shutap" },
      { property: "og:description", content: "The platform's greatest moments." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm text-c-text-2">The Hall is dark tonight.</p>
      <p className="text-xs text-c-text-3 break-words">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-c-pink-soft text-c-pink-ink text-sm">Re-light</button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-c-text-2 text-sm">Nothing on the docket.</div>
  ),
});

function HofPage() {
  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-32">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/stream" className="text-c-text-3 text-sm">←</Link>
          <div className="flex-1 text-center text-sm font-medium">Hall of Fame</div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-surface-3 bg-c-surface">
        <HofBody />
      </main>
    </div>
  );
}

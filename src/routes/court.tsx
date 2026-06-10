import { createFileRoute, Link } from "@tanstack/react-router";
import { CourtBody } from "@/components/sections/CourtBody";

export const Route = createFileRoute("/court")({
  component: CourtPage,
  head: () => ({
    meta: [
      { title: "👑 Relationship Court™ — Where the internet decides" },
      {
        name: "description",
        content:
          "Live community trials. Global, country, and local Courts. Vote, debate, watch the verdict land. Real stories, real countdown, real consequences.",
      },
      { property: "og:title", content: "👑 Relationship Court™" },
      { property: "og:description", content: "Where the internet decides." },
      { property: "og:type", content: "website" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-4">
      <p className="text-sm text-muted-foreground">The court is in recess.</p>
      <p className="text-xs text-muted-foreground/70 break-words">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
      >
        Reconvene
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-sm text-muted-foreground">No case file under that docket.</p>
    </div>
  ),
});

function CourtPage() {
  return (
    <div className="min-h-screen bg-c-surface text-c-text-1 pb-24">
      <header className="sticky top-0 z-30 bg-c-surface/85 backdrop-blur border-b border-c-surface-3">
        <div className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl px-4 py-2.5 flex items-center justify-between">
          <Link to="/stream" className="text-[17px] font-medium tracking-tight">
            shut<span className="text-c-pink-deep">ap</span>
          </Link>
          <span className="live-pill"><span className="live-pill__dot" />Family Court · Live</span>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] md:max-w-[640px] lg:max-w-3xl border-x border-c-border">
        <CourtBody />
      </main>
    </div>
  );
}

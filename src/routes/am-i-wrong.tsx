import { createFileRoute, Link } from "@tanstack/react-router";
import { headAmIWrong } from "@/lib/seo/meta";

export const Route = createFileRoute("/am-i-wrong")({
  component: AmIWrongPage,
  head: () => headAmIWrong(),
});

function AmIWrongPage() {
  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <a href="https://app.shutap.com/spill" className="text-xs text-c-text-2">Open a case</a>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16 space-y-8">
        <h1 className="font-serif text-3xl sm:text-5xl tracking-tight">Am I wrong?</h1>
        <p className="text-base text-c-text-2 leading-relaxed">
          Spill the situation. Stay anonymous. Thousands of real people read the case and deliver a verdict
          within days. Then come back, and tell the court what actually happened.
        </p>
        <a
          href="https://app.shutap.com/spill"
          className="inline-flex items-center justify-center rounded-md bg-c-text-1 px-5 py-3 text-sm font-medium text-c-surface hover:opacity-90 transition"
        >
          Open a case anonymously →
        </a>
      </article>
    </main>
  );
}

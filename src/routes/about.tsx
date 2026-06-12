import { createFileRoute, Link } from "@tanstack/react-router";
import { headAbout } from "@/lib/seo/meta";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => headAbout(),
});

function AboutPage() {
  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <a href="https://app.shutap.com/court" className="text-xs text-c-text-2">Enter the Court</a>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16 space-y-8">
        <h1 className="font-serif text-3xl sm:text-5xl tracking-tight">The memory of human experience.</h1>
        <p className="text-base text-c-text-2 leading-relaxed">
          Shutap is the anonymous court of public opinion. Real people share real conflicts.
          Thousands deliver a verdict. The storyteller returns and tells the world what actually happened.
        </p>
        <p className="text-base text-c-text-2 leading-relaxed">
          Every resolved case becomes a permanent public record — a community verdict paired with a real-world
          outcome. No fiction. No models. No retraining loop. Just the slow, unglamorous record of how humans
          actually behave when nobody is watching their name.
        </p>
        <p className="text-base text-c-text-2 leading-relaxed">In an AI world, stay human.</p>
      </article>
    </main>
  );
}

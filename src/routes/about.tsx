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

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight tracking-tight text-balance">
          The World's Memory of Human Experience
        </h1>

        <div className="mt-10 space-y-6 text-base sm:text-lg leading-relaxed text-c-text-2">
          <p>
            Every day, millions of people face situations with no clean answer — a relationship on the edge,
            a family dispute, a workplace betrayal, an impossible decision.
          </p>
          <p>They navigate them. They learn something. And then the lesson disappears.</p>
          <p>Shutap exists so it doesn't.</p>
          <p>
            Here, a story becomes a case. A case gets a verdict from thousands of real people. And months later,
            the person who lived it comes back and tells the court what actually happened.
          </p>
          <p>
            Not AI-generated advice. Not influencer opinions. Lived experience, judged by humans, confirmed by reality.
          </p>
          <p>
            We believe authentic human experience is the most valuable thing in an AI world — and we are building
            the library that keeps it from being forgotten.
          </p>
        </div>

        <section className="mt-14 border-t border-c-border pt-10">
          <h2 className="font-serif text-xl tracking-tight text-c-text-1">Mission</h2>
          <p className="mt-4 text-base sm:text-lg text-c-text-2 leading-relaxed">
            Preserve real stories, real decisions, and real outcomes so future generations can learn from human
            experience — not just AI-generated knowledge.
          </p>
        </section>

        <p className="mt-14 font-serif text-2xl sm:text-3xl text-c-text-1 tracking-tight">
          In an AI world, stay human.
        </p>
      </article>

      <footer className="border-t border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-c-text-3">
          18+ · Anonymous · Real verdicts · Real outcomes
        </div>
      </footer>
    </main>
  );
}

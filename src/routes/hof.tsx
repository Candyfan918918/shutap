// /hof — renders the designed static HTML so the original CSS/JS run as authored.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hof")({
  component: HofPage,
  head: () => ({
    meta: [
      { title: "Hall of Fame — Shutap" },
      { name: "description", content: "The verdicts that landed hardest." },
      { property: "og:title", content: "Hall of Fame — Shutap" },
      { property: "og:description", content: "The verdicts that landed hardest." },
    ],
  }),
});

function HofPage() {
  return (
    <iframe
      src="/hof.html"
      title="Hall of Fame"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", background: "#fcf1f5" }}
    />
  );
}

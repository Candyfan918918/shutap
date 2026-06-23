// /court — renders the designed static HTML so the original CSS/JS run as authored.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/court")({
  component: CourtPage,
  head: () => ({
    meta: [
      { title: "The Court — Shutap" },
      { name: "description", content: "Live community trials. Vote, debate, watch the verdict land." },
      { property: "og:title", content: "The Court — Shutap" },
      { property: "og:description", content: "Where the internet decides." },
    ],
  }),
});

function CourtPage() {
  return (
    <iframe
      src="/court.html"
      title="The Court"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", background: "#fcf1f5" }}
    />
  );
}

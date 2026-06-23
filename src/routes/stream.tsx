// /stream — renders the designed static HTML so the original CSS/JS run as authored.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stream")({
  component: StreamPage,
  head: () => ({
    meta: [
      { title: "The Story Stream — Shutap" },
      { name: "description", content: "What people are bringing to the court, in their own words." },
      { property: "og:title", content: "The Story Stream — Shutap" },
      { property: "og:description", content: "What people are bringing to the court, in their own words." },
    ],
  }),
});

function StreamPage() {
  return (
    <iframe
      src="/stream.html"
      title="The Story Stream"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", background: "#fcf1f5" }}
    />
  );
}

// Shutap marketing homepage — renders the designed static landing page from /public/landing.html
// so all original CSS/JS interactions run exactly as authored.
import { createFileRoute } from "@tanstack/react-router";
import { headHome } from "@/lib/seo/meta";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => headHome(),
});

function HomePage() {
  return (
    <iframe
      src="/landing.html"
      title="Shutap"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        background: "#fcf1f5",
      }}
    />
  );
}

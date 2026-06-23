import { createFileRoute } from "@tanstack/react-router";
import { StaticHtmlFrame } from "@/components/StaticHtmlFrame";

export const Route = createFileRoute("/welcome")({
  component: () => <StaticHtmlFrame src="/welcome.html" title="Welcome — Shutap" />,
});

import { createFileRoute } from "@tanstack/react-router";
import { StaticHtmlFrame } from "@/components/StaticHtmlFrame";

export const Route = createFileRoute("/court")({
  component: () => <StaticHtmlFrame src="/court.html" title="Court — Shutap" />,
});

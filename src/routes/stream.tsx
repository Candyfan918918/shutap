import { createFileRoute } from "@tanstack/react-router";
import { StaticHtmlFrame } from "@/components/StaticHtmlFrame";

export const Route = createFileRoute("/stream")({
  component: () => <StaticHtmlFrame src="/stream.html" title="Stream — Shutap" />,
});

import { createFileRoute } from "@tanstack/react-router";
import { StaticHtmlFrame } from "@/components/StaticHtmlFrame";

export const Route = createFileRoute("/_authenticated/me")({
  component: () => <StaticHtmlFrame src="/profile.html" title="Profile — Shutap" />,
});

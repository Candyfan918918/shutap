import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/mod-queue")({
  component: () => (
    <AdminStub
      title="Moderation Queue"
      description="Paused candidacy, AI triage flags, escalation queue. Approve, remove, or escalate — every action lands in mod_actions."
      allowed={["super_admin", "moderator"]}
    />
  ),
});

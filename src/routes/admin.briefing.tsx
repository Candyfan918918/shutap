import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/briefing")({
  component: () => (
    <AdminStub
      title="AI Briefing"
      description="Daily synthesis. Trends, anomalies, and risk signals — filtered to your role."
      allowed={["super_admin", "moderator", "analyst", "partner_manager"]}
    />
  ),
});

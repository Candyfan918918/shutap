import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/analytics")({
  component: () => (
    <AdminStub
      title="Analytics"
      description="Verdict velocity, court tier distribution, region heat, retention cohorts."
      allowed={["super_admin", "analyst"]}
    />
  ),
});

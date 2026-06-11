import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/config")({
  component: () => (
    <AdminStub
      title="Platform Config"
      description="City courts, nomination caps, rate limits, feature flags."
      allowed={["super_admin"]}
    />
  ),
});

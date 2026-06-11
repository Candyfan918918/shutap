import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/leads")({
  component: () => (
    <AdminStub
      title="Lead Management"
      description="Partner intents and lead contacts. Story content is hidden — alias and category only."
      allowed={["super_admin", "partner_manager"]}
    />
  ),
});

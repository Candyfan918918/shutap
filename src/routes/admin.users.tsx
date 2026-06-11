import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/components/admin/Stub";
export const Route = createFileRoute("/admin/users")({
  component: () => (
    <AdminStub
      title="Admin Users"
      description="Provision, deactivate, and rotate TOTP for admin accounts. Append-only audit on every change."
      allowed={["super_admin"]}
    />
  ),
});

// Role-gated placeholder for routes shipping in later phases.
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminMe } from "@/lib/admin/auth.functions";

type Role = "super_admin" | "moderator" | "analyst" | "partner_manager";

export function AdminStub({
  title,
  description,
  allowed,
}: {
  title: string;
  description: string;
  allowed: ReadonlyArray<Role>;
}) {
  const me = useServerFn(getAdminMe);
  const navigate = useNavigate();
  const [denied, setDenied] = useState<boolean | null>(null);

  useEffect(() => {
    me({}).then((r) => {
      if (!r) { navigate({ to: "/admin/login" }); return; }
      if (!allowed.includes(r.role as Role)) {
        setDenied(true);
        sessionStorage.setItem("admin_access_denied", "1");
        navigate({ to: "/admin" });
      } else setDenied(false);
    });
  }, [me, navigate, allowed]);

  if (denied !== false) return null;
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-zinc-100">{title}</h1>
      <p className="text-sm text-zinc-400 max-w-prose">{description}</p>
      <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] px-4 py-6 text-sm text-zinc-500">
        Pending migration. Ships in Step 11.2.
      </div>
      <Link to="/admin" className="text-xs text-zinc-400 hover:text-zinc-200">← Back to dashboard</Link>
    </div>
  );
}

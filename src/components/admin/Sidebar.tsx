// Fixed left sidebar — 220px, dark surface. Role-filtered nav.
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminLogout } from "@/lib/admin/auth.functions";

type Role = "super_admin" | "moderator" | "analyst" | "partner_manager";

const NAV: ReadonlyArray<{ to: string; label: string; roles: ReadonlyArray<Role> }> = [
  { to: "/admin", label: "Dashboard", roles: ["super_admin", "moderator", "analyst", "partner_manager"] },
  { to: "/admin/mod-queue", label: "Moderation Queue", roles: ["super_admin", "moderator"] },
  { to: "/admin/audit-log", label: "Audit Log", roles: ["super_admin", "moderator", "analyst"] },
  { to: "/admin/analytics", label: "Analytics", roles: ["super_admin", "analyst"] },
  { to: "/admin/briefing", label: "AI Briefing", roles: ["super_admin", "moderator", "analyst", "partner_manager"] },
  { to: "/admin/leads", label: "Lead Management", roles: ["super_admin", "partner_manager"] },
  { to: "/admin/config", label: "Platform Config", roles: ["super_admin"] },
  { to: "/admin/users", label: "Admin Users", roles: ["super_admin"] },
];

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "super admin",
  moderator: "moderator",
  analyst: "analyst",
  partner_manager: "partner manager",
};

export function AdminSidebar({
  role,
  displayName,
}: {
  role: Role;
  displayName: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const logout = useServerFn(adminLogout);

  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col bg-[oklch(0.18_0.01_270)] text-zinc-200 border-r border-zinc-800">
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Shutap</div>
        <div className="text-sm font-medium text-zinc-100">The Bench</div>
      </div>
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {items.map((item) => {
          const active =
            item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`block px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
        <div className="text-xs text-zinc-400 leading-tight">
          <span className="text-zinc-200">{displayName}</span>
          <span className="text-zinc-500"> · {ROLE_LABEL[role]}</span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout({});
            navigate({ to: "/admin/login" });
          }}
          className="w-full text-left text-xs text-zinc-400 hover:text-zinc-100"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}

// /admin/* shell — sidebar + session check. Redirects to /admin/login when no session.
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminMe } from "@/lib/admin/auth.functions";
import { AdminSidebar } from "@/components/admin/Sidebar";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex,nofollow" },
      { title: "Admin — Shutap" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return;
    const me = await getAdminMe({});
    if (!me) throw redirect({ to: "/admin/login" });
    return { admin: me };
  },
  component: AdminShell,
});

function AdminShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/admin/login") return <Outlet />;
  return <AdminAuthedShell />;
}

function AdminAuthedShell() {
  const me = useServerFn(getAdminMe);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminMe>> | null>(null);
  useEffect(() => {
    me({}).then(setData);
  }, [me]);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.16_0.01_270)] text-zinc-500 text-sm">
        Verifying credentials.
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-[oklch(0.16_0.01_270)] text-zinc-200">
      <AdminSidebar role={data.role as any} displayName={data.displayName} />
      <main className="flex-1 min-w-0 px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}

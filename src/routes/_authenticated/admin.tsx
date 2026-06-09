// Admin shell — gates the /admin subtree on the admin role.
import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: ures } = await supabase.auth.getUser();
    if (!ures.user) throw redirect({ to: "/enter", search: { redirect: "/admin" } });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ures.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: AdminShell,
});

function AdminShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/admin/modQueue.functions").then(({ listModQueue }) =>
      listModQueue({ data: { status: "pending" } })
        .then((res) => {
          if (!cancelled) setPending(res.items.length);
        })
        .catch(() => setPending(null)),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-sm font-medium tracking-wide uppercase text-muted-foreground">Bench Admin</h1>
          <nav className="flex gap-2 text-sm">
            <Tab to="/admin" active={path === "/admin"}>City Courts</Tab>
            <Tab to="/admin/mod-queue" active={path.startsWith("/admin/mod-queue")}>
              Mod Queue{pending != null && pending > 0 ? ` · ${pending}` : ""}
            </Tab>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-surface-elevated border-border hover:border-primary/40"
      }`}
    >
      {children}
    </Link>
  );
}

// Pathless layout that gates every child route on a hydrated Supabase session.
// Children under src/routes/_authenticated/* are auto-protected; unauthenticated
// users are redirected to /enter with a `redirect` search param so /welcome
// (or wherever they wanted to land) is restored after sign-in.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  beforeLoad: async ({ location }) => {
    // Intentionally getUser() not getSession(): getUser() round-trips to the
    // Supabase Auth server and validates the JWT, so forged or expired tokens
    // sitting in localStorage cannot bypass this guard. getSession() only
    // reads local storage and would trust whatever's there.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/enter",
        search: { redirect: location.href },
      });
    }
  },
  // While beforeLoad's getUser() call is in flight, TanStack Router holds the
  // previous route — no protected content renders until verification resolves.
  pendingComponent: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
    </div>
  ),
  component: () => <Outlet />,
});

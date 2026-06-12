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
    // Use getSession() (local, no network) instead of getUser() to avoid
    // network-blip false negatives that would bounce signed-in users to /enter.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/enter",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});

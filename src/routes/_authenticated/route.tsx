// Pathless layout gating every child route on a Supabase session.
// ssr:false is required: the session lives in localStorage, so the server
// has nothing to read. Doing this check during SSR caused signed-in users to
// get bounced to /enter on every protected navigation, which then forwarded
// them to /welcome and forced them to re-claim their alias.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/enter", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  pendingComponent: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
    </div>
  ),
  component: () => <Outlet />,
});

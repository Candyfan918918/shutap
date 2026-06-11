// Public alias profile: /alias/$aliasId
// aliasId is treated as the profile handle. Resolves and redirects to the
// canonical /u/$handle view so existing profile UI is the single source.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/alias/$aliasId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/u/$handle", params: { handle: params.aliasId } });
  },
  component: () => null,
});

// /me — redirect to /u/{my handle}.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

function MePage() {
  const fetchMe = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });
  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">loading…</div>;
  if (!data) return <Navigate to="/" />;
  return <Navigate to="/u/$handle" params={{ handle: data.handle }} replace />;
}

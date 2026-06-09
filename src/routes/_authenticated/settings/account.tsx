// Account: email, sign-out.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMyProfile);
  const { data } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("see you soon 👋");
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6">
      <Section title="Account">
        <Row label="Email" value={data?.email ?? "—"} />
        <Row label="Display name" value={data?.displayName ?? "—"} />
        <Row label="@handle" value={data ? `@${data.handle}` : "—"} />
      </Section>

      <Section title="Sign-in methods" sub="Manage how you sign into your account.">
        <div className="text-sm text-muted-foreground">
          Connected via Lovable Cloud Auth. To link or unlink Google/Apple, sign out and re-enter with that method.
        </div>
      </Section>

      <button
        onClick={signOut}
        className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 font-medium"
      >
        Sign out
      </button>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium mb-1">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground mb-3">{sub}</p>}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">{children}</div>
    </section>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}

// Notifications preferences.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsPage,
});

const FLAGS = [
  { key: "likes", label: "❤️ likes on my posts", default: true },
  { key: "comments", label: "💬 comments on my posts", default: true },
  { key: "follows", label: "➕ new followers", default: true },
  { key: "friends", label: "🫂 friend requests", default: true },
  { key: "replies", label: "↩️ story replies", default: true },
  { key: "challenges", label: "👀 chaos score challenges", default: true },
] as const;

function NotificationsPage() {
  const fetchMe = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });
  const [state, setState] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const init: Record<string, boolean> = {};
      for (const f of FLAGS) init[f.key] = data.notifPrefs[f.key] ?? f.default;
      setState(init);
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await update({ data: { notifPrefs: state } });
      toast.success("saved 🔔");
      qc.invalidateQueries({ queryKey: ["me_profile"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="text-muted-foreground">loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Notifications</h2>
        <p className="text-sm text-muted-foreground">Pick what's worth pinging you for.</p>
      </div>
      <div className="space-y-2">
        {FLAGS.map((f) => (
          <button
            key={f.key}
            onClick={() => setState((s) => ({ ...s, [f.key]: !s[f.key] }))}
            className="w-full px-4 py-3 rounded-2xl bg-card border border-border flex items-center justify-between"
          >
            <span className="text-sm text-left">{f.label}</span>
            <span className={`w-10 h-6 rounded-full relative transition ${state[f.key] ? "bg-primary" : "bg-border"}`}>
              <span className={`absolute top-0.5 ${state[f.key] ? "right-0.5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition`} />
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold disabled:opacity-40"
      >
        {saving ? "saving…" : "save"}
      </button>
    </div>
  );
}

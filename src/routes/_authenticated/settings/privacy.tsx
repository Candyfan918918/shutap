// Privacy controls.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  component: PrivacyPage,
});

const FLAGS = [
  { key: "follow_me", label: "anyone can follow me", default: true },
  { key: "friend_me", label: "anyone can send friend requests", default: true },
  { key: "comment", label: "anyone can comment on my posts", default: true },
  { key: "mention", label: "anyone can @mention me", default: true },
  { key: "hide_city", label: "🌍 hide my city", default: false },
  { key: "hide_score", label: "🚨 hide my average score", default: false },
  { key: "hide_ranking", label: "🏆 hide me from rankings", default: false },
] as const;

function PrivacyPage() {
  const fetchMe = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });
  const [state, setState] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const init: Record<string, boolean> = {};
      for (const f of FLAGS) init[f.key] = data.privacy[f.key] ?? f.default;
      setState(init);
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await update({ data: { privacy: state } });
      toast.success("saved 🔒");
      qc.invalidateQueries({ queryKey: ["me_profile"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="text-muted-foreground">loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Privacy</h2>
        <p className="text-sm text-muted-foreground">Mysterious energy is encouraged.</p>
      </div>
      <div className="space-y-2">
        {FLAGS.map((f) => (
          <Toggle key={f.key} label={f.label} value={!!state[f.key]} onChange={(v) => setState((s) => ({ ...s, [f.key]: v }))} />
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold disabled:opacity-40"
      >
        {saving ? "saving…" : "save privacy"}
      </button>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full px-4 py-3 rounded-2xl bg-card border border-border flex items-center justify-between"
    >
      <span className="text-sm text-left">{label}</span>
      <span className={`w-10 h-6 rounded-full relative transition ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 ${value ? "right-0.5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition`} />
      </span>
    </button>
  );
}

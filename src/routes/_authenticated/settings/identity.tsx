// Identity: display name, handle, avatar, bio, anonymous mode.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { HandleEditor } from "@/components/identity/HandleEditor";
import { AvatarEditor } from "@/components/identity/AvatarEditor";

export const Route = createFileRoute("/_authenticated/settings/identity")({
  component: IdentityPage,
});

function IdentityPage() {
  const fetchMe = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName);
      setBio(data.bio ?? "");
      setAnonymous(data.anonymousMode);
    }
  }, [data]);

  const saveBasics = async () => {
    setSaving(true);
    try {
      await update({ data: { displayName, bio, anonymousMode: anonymous } });
      toast.success("saved ✨");
      qc.invalidateQueries({ queryKey: ["me_profile"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="text-muted-foreground">The record is being pulled.</div>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-medium mb-3">Avatar</h2>
        <AvatarEditor currentUrl={data.avatarUrl} onChanged={() => qc.invalidateQueries({ queryKey: ["me_profile"] })} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-1">Display name</h2>
        <p className="text-sm text-muted-foreground mb-3">Can repeat. Format like <em>Shanghai · Chaos Queen</em>.</p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
          className="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary"
        />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-1">@handle</h2>
        <p className="text-sm text-muted-foreground mb-3">Must be unique. Letters, numbers, underscores only.</p>
        <HandleEditor currentHandle={data.handle} onChanged={() => qc.invalidateQueries({ queryKey: ["me_profile"] })} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-1">Bio</h2>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 200))}
          rows={3}
          placeholder="what's your vibe? (200 chars max)"
          className="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary"
        />
        <div className="text-right text-xs text-muted-foreground mt-1">{bio.length}/200</div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-1">Anonymous mode</h2>
        <p className="text-sm text-muted-foreground mb-3">When on: hides your city & average score on your profile.</p>
        <ToggleRow value={anonymous} onChange={setAnonymous} label="anonymous era" />
      </section>

      <button
        onClick={saveBasics}
        disabled={saving}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-40"
      >
        {saving ? "saving…" : "save profile"}
      </button>
    </div>
  );
}

function ToggleRow({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-border flex items-center justify-between"
    >
      <span className="text-sm">{label}</span>
      <span className={`w-10 h-6 rounded-full relative transition ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 ${value ? "right-0.5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition`} />
      </span>
    </button>
  );
}

// Language preference.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings/language")({
  component: LanguagePage,
});

const LANGS = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
] as const;

function LanguagePage() {
  const fetchMe = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me_profile"], queryFn: () => fetchMe() });
  const [locale, setLocale] = useState("en");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setLocale(data.locale); }, [data]);

  const save = async (id: string) => {
    setLocale(id);
    setSaving(true);
    try {
      await update({ data: { locale: id } });
      if (typeof window !== "undefined") localStorage.setItem("md.locale", id);
      toast.success("language set 🌍");
      qc.invalidateQueries({ queryKey: ["me_profile"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="text-muted-foreground">The record is being pulled.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Language</h2>
        <p className="text-sm text-muted-foreground">Auto-detected from your browser. Override here.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LANGS.map((l) => (
          <button
            key={l.id}
            disabled={saving}
            onClick={() => save(l.id)}
            className={`px-4 py-3 rounded-2xl border text-sm font-medium ${
              locale === l.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Avatar editor: upload OR generate AI avatar.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload } from "lucide-react";
import {
  createAvatarUploadUrl, setMyAvatar, generateAiAvatar,
} from "@/lib/profile.functions";

const STYLES = [
  { id: "cartoon", label: "🎨 cartoon" },
  { id: "anime", label: "🌸 anime" },
  { id: "luxury", label: "💎 luxury" },
  { id: "chaos", label: "🌪️ chaos queen" },
  { id: "mysterious", label: "🫥 mysterious" },
  { id: "soft", label: "☁️ soft" },
] as const;
type Style = typeof STYLES[number]["id"];

export function AvatarEditor({ currentUrl, onChanged }: { currentUrl: string | null; onChanged?: (url: string) => void }) {
  const createUrl = useServerFn(createAvatarUploadUrl);
  const setAvatar = useServerFn(setMyAvatar);
  const genAi = useServerFn(generateAiAvatar);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<Style>("cartoon");
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const onPickFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("max 5MB"); return; }
    const extMatch = file.name.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/);
    const ext = (extMatch?.[1] ?? "png") as "png" | "jpg" | "jpeg" | "webp";
    setBusy(true);
    try {
      const { uploadUrl, publicUrl } = await createUrl({ data: { ext } });
      const up = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "image/png" } });
      if (!up.ok) throw new Error("upload failed");
      await setAvatar({ data: { avatarUrl: publicUrl, kind: "upload" } });
      setPreview(publicUrl);
      onChanged?.(publicUrl);
      toast.success("new face unlocked ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "upload failed");
    } finally { setBusy(false); }
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      const r = await genAi({ data: { style } });
      setPreview(r.url);
      onChanged?.(r.url);
      toast.success("generated 🪄");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI didn't cooperate");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-elevated border border-border grid place-items-center text-3xl">
          {preview ? <img src={preview} alt="avatar" className="w-full h-full object-cover" /> : "👤"}
        </div>
        <div className="flex-1 space-y-2">
          <label className="block">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); }}
            />
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm cursor-pointer hover:border-primary/60">
              <Upload className="w-4 h-4" /> upload photo
            </span>
          </label>
          <p className="text-xs text-muted-foreground">PNG/JPG up to 5MB. anonymity is the move.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <div className="text-sm font-medium">or generate an AI avatar (5/day)</div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`px-3 py-1.5 rounded-full border text-sm ${
                style === s.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={onGenerate}
          className="w-full py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "✨ generate"}
        </button>
      </div>
    </div>
  );
}

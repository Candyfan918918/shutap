import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ChatAttachment } from "@/lib/spill/types";

export function ReceiptsUploader({
  draftId,
  userId,
  onUploaded,
  compact = false,
}: {
  draftId: string;
  userId: string;
  onUploaded: (atts: ChatAttachment[]) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setBusy(true);
    const out: ChatAttachment[] = [];
    try {
      for (const f of files) {
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${userId}/${draftId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("story-media")
          .upload(path, f, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data } = supabase.storage.from("story-media").getPublicUrl(path);
        out.push({
          url: data.publicUrl,
          kind: f.type.startsWith("video/")
            ? "video"
            : f.type.startsWith("audio/")
            ? "audio"
            : "image",
          name: f.name,
        });
      }
      if (out.length) onUploaded(out);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={
          compact
            ? "shrink-0 grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-border hover:border-primary/60 disabled:opacity-50 transition"
            : "w-full py-3 rounded-full bg-surface-elevated border border-border text-sm hover:border-primary/60 disabled:opacity-50 transition"
        }
        title="Drop receipts"
      >
        {busy ? "…" : compact ? "📎" : "📱 Drop receipts"}
      </button>
    </>
  );
}

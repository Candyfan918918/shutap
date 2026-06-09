// Live-availability @handle editor with suggestions.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { checkHandleAvailable, changeMyHandle } from "@/lib/profile.functions";
import { slugifyHandle, validateHandle } from "@/lib/handles";

export function HandleEditor({ currentHandle, onChanged }: { currentHandle: string; onChanged?: (h: string) => void }) {
  const check = useServerFn(checkHandleAvailable);
  const change = useServerFn(changeMyHandle);
  const [value, setValue] = useState(currentHandle);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => validateHandle(slugifyHandle(value)), [value]);
  const isCurrent = value === currentHandle;

  useEffect(() => {
    if (isCurrent || !validation.ok) {
      setAvailable(null); setSuggestions([]); return;
    }
    const slug = slugifyHandle(value);
    setChecking(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await check({ data: { handle: slug } });
        setAvailable(r.available);
        setSuggestions(r.suggestions);
      } finally {
        setChecking(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [value, isCurrent, validation.ok, check]);

  const save = async () => {
    const slug = slugifyHandle(value);
    if (!validation.ok) { toast.error(validation.message ?? "invalid"); return; }
    if (!available) { toast.error("that handle is taken"); return; }
    setSaving(true);
    try {
      await change({ data: { handle: slug } });
      toast.success(`you're now @${slug} ✨`);
      onChanged?.(slug);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "couldn't save");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
        <input
          value={value}
          onChange={(e) => setValue(slugifyHandle(e.target.value))}
          maxLength={24}
          className="w-full pl-7 pr-10 py-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary text-base"
          placeholder="chaosqueen"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {checking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!checking && available === true && !isCurrent && <span className="text-emerald-400 text-sm">✓</span>}
          {!checking && available === false && <span className="text-red-400 text-sm">✗</span>}
        </div>
      </div>
      {!validation.ok && value && (
        <div className="text-xs text-red-400">{validation.message}</div>
      )}
      {available === false && (
        <div className="text-xs text-muted-foreground">
          @{slugifyHandle(value)} is taken (bestie has taste). try one of these:
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setValue(s)}
                className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm hover:border-primary/60"
              >
                @{s}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={save}
        disabled={isCurrent || !available || saving}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-40"
      >
        {saving ? "saving…" : isCurrent ? "this is your handle" : "save handle"}
      </button>
    </div>
  );
}

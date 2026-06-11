import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listBriefingItems, markBriefingRead } from "@/lib/admin/briefing.functions";
import { getAdminMe } from "@/lib/admin/auth.functions";

const PRIORITY_STYLE: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-200",
  high: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  medium: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
  opportunity: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

export const Route = createFileRoute("/admin/briefing")({
  component: BriefingPage,
});

function todayIso() { return new Date().toISOString().slice(0, 10); }

function BriefingPage() {
  const me = useServerFn(getAdminMe);
  const list = useServerFn(listBriefingItems);
  const markRead = useServerFn(markBriefingRead);

  const [role, setRole] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me({}).then((r) => {
      if (!r) { window.location.href = "/admin/login"; return; }
      setRole(r.role);
    });
  }, [me]);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    list({ data: { date } }).then((r) => { setItems(r.items as any[]); setLoading(false); });
  }, [role, date, list]);

  if (!role) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">AI Briefing</h1>
          <p className="text-xs text-zinc-500">Generated daily at 08:00 UTC.</p>
        </div>
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[oklch(0.20_0.01_270)] border border-zinc-700 text-sm text-zinc-200 px-2 py-1 rounded"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-6 text-sm text-zinc-400">
          No briefing for {date}. The room has been suspiciously calm.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded border p-4 space-y-2 transition-opacity ${
                it.read ? "opacity-60 border-zinc-800 bg-[oklch(0.20_0.01_270)]" : "border-zinc-700 bg-[oklch(0.22_0.01_270)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-[0.14em] border px-2 py-0.5 rounded ${PRIORITY_STYLE[it.priority] ?? PRIORITY_STYLE.medium}`}>
                    {it.priority}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{it.category}</span>
                </div>
                {!it.read && (
                  <button
                    onClick={async () => {
                      await markRead({ data: { id: it.id } });
                      setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, read: true } : x));
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-100"
                  >
                    Mark as read
                  </button>
                )}
              </div>
              <div className="font-medium text-zinc-100">{it.title}</div>
              <div className="text-sm text-zinc-300 leading-relaxed">{it.detail}</div>
              {it.recommendation && (
                <div className="text-sm italic text-zinc-400">{it.recommendation}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

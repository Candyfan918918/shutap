// Internal CRM: admin-only lead pipeline. Server fn re-checks the admin role.
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { listLeadsForAdmin } from "@/lib/leads.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/enter" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: AdminLeadsPage,
});

const INTENT_META: Record<string, { emoji: string; label: string }> = {
  reactions: { emoji: "☕", label: "Reactions" },
  support: { emoji: "🫂", label: "Support" },
  documentation: { emoji: "📝", label: "Docs" },
  legal: { emoji: "⚖️", label: "Legal" },
  next_steps: { emoji: "💔", label: "Next steps" },
};

const TEMP_META: Record<string, { emoji: string; color: string }> = {
  hot:   { emoji: "🔥", color: "bg-red-500/15 border-red-500/40 text-red-400" },
  warm:  { emoji: "☕", color: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
  early: { emoji: "👀", color: "bg-blue-500/15 border-blue-500/40 text-blue-400" },
  cold:  { emoji: "🧊", color: "bg-muted border-border text-muted-foreground" },
};

function AdminLeadsPage() {
  const fetchLeads = useServerFn(listLeadsForAdmin);
  const [sort, setSort] = useState<"score" | "recent" | "urgency">("score");
  const [temperature, setTemperature] = useState<"all" | "hot" | "warm" | "early" | "cold">("all");
  const [intent, setIntent] = useState<"all" | "reactions" | "support" | "documentation" | "legal" | "next_steps">("all");
  const [city, setCity] = useState("");

  const query = useQuery({
    queryKey: ["admin_leads", sort, temperature, intent, city],
    queryFn: () => fetchLeads({ data: { sort, temperature, intent, city: city || undefined, limit: 100 } }),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-semibold text-sm">⚖️ Lead pipeline · admin</div>
          <span className="w-6" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm">
            <option value="score">Sort: lead score</option>
            <option value="urgency">Sort: urgency</option>
            <option value="recent">Sort: most recent</option>
          </select>
          <select value={temperature} onChange={(e) => setTemperature(e.target.value as typeof temperature)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm">
            <option value="all">All temperatures</option>
            <option value="hot">🔥 hot</option>
            <option value="warm">☕ warm</option>
            <option value="early">👀 early</option>
            <option value="cold">🧊 cold</option>
          </select>
          <select value={intent} onChange={(e) => setIntent(e.target.value as typeof intent)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm">
            <option value="all">All intents</option>
            <option value="legal">⚖️ Legal</option>
            <option value="next_steps">💔 Next steps</option>
            <option value="documentation">📝 Docs</option>
            <option value="support">🫂 Support</option>
            <option value="reactions">☕ Reactions</option>
          </select>
          <input
            placeholder="Filter by city…"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm"
            maxLength={120}
          />
        </div>

        {query.isLoading && <div className="text-center text-muted-foreground py-12">loading leads…</div>}
        {query.error && <div className="text-center text-red-400 py-12">{(query.error as Error).message}</div>}

        {query.data && query.data.length === 0 && (
          <div className="text-center text-muted-foreground py-16 border border-dashed border-border rounded-2xl">
            <div className="text-4xl mb-2">📭</div>
            No leads match these filters yet.
          </div>
        )}

        <div className="space-y-2">
          {(query.data ?? []).map((row) => {
            const tm = TEMP_META[row.leadTemperature] ?? TEMP_META.cold;
            const im = INTENT_META[row.intent] ?? { emoji: "•", label: row.intent };
            return (
              <div key={row.intentId} className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${tm.color}`}>
                        {tm.emoji} {row.leadTemperature} · {row.leadScore}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                        {im.emoji} {im.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                        ⏱ urgency {row.urgency}/5
                      </span>
                      {row.courtStatus && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/40 text-primary">
                          🏛 {row.courtStatus}
                        </span>
                      )}
                      {row.city && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                          📍 {row.city}{row.countryCode ? ` · ${row.countryCode}` : ""}
                        </span>
                      )}
                    </div>

                    {row.postTitle && (
                      <Link
                        to="/post/$postId"
                        params={{ postId: row.postId! }}
                        className="block mt-2 font-semibold text-sm hover:text-primary line-clamp-2"
                      >
                        {row.postTitle}
                        {row.postScore != null && (
                          <span className="text-xs text-muted-foreground ml-2">chaos {row.postScore}</span>
                        )}
                      </Link>
                    )}

                    {row.handle && (
                      <Link to="/u/$handle" params={{ handle: row.handle }} className="text-xs text-muted-foreground hover:text-foreground">
                        @{row.handle}
                      </Link>
                    )}

                    {row.contact ? (
                      <div className="mt-3 text-xs space-y-0.5 bg-surface-elevated rounded-xl p-2 border border-border">
                        <div className="text-muted-foreground uppercase tracking-wide text-[10px]">Consented contact · {row.contact.status}</div>
                        {row.contact.email && <div>✉️ {row.contact.email}</div>}
                        {row.contact.phone && <div>📞 {row.contact.phone}</div>}
                        {row.contact.city && <div>📍 {row.contact.city}</div>}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-muted-foreground">No consented contact yet</div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground shrink-0">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {Object.keys(row.signals || {}).length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Signals</summary>
                    <pre className="mt-1 p-2 rounded-lg bg-surface-elevated border border-border overflow-x-auto text-[11px]">
                      {JSON.stringify(row.signals, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

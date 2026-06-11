// Moderation Queue — admin tool. Information-dense table + slide-out detail panel.
// Polls every 60s. No animations.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listModQueue, getModQueueItem, submitModAction } from "@/lib/admin/mod-queue.functions";

type QueueRow = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  entity_type: string;
  entity_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  status: string;
  priority_score: number;
  ai_recommendation: string | null;
  ai_confidence: number | null;
  assigned_admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

const SEVERITY_BADGE: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  critical: { dot: "🔴", bg: "bg-red-950/60 border-red-900", text: "text-red-300", label: "Critical" },
  high:     { dot: "🟡", bg: "bg-amber-950/60 border-amber-900", text: "text-amber-300", label: "High" },
  medium:   { dot: "🟣", bg: "bg-purple-950/60 border-purple-900", text: "text-purple-300", label: "Medium" },
  low:      { dot: "⚪", bg: "bg-zinc-800/60 border-zinc-700", text: "text-zinc-300", label: "Low" },
};

const ACTION_LABEL: Record<string, string> = {
  no_action: "No action",
  warn_user: "Warn user",
  remove_content: "Remove content",
  suspend_7d: "Suspend (7d)",
  ban: "Ban",
  escalate: "Escalate",
  refer_to_legal: "Refer to legal",
};

const ACTIONS = ["no_action","warn_user","remove_content","suspend_7d","ban","escalate","refer_to_legal"] as const;

const OVERRIDE_REASONS: Array<{ value: string; label: string }> = [
  { value: "evidence_insufficient", label: "Evidence insufficient" },
  { value: "context_changes_assessment", label: "Context changes assessment" },
  { value: "policy_interpretation_differs", label: "Policy interpretation differs" },
  { value: "edge_case", label: "Edge case" },
  { value: "other", label: "Other" },
];

function timeIn(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export const Route = createFileRoute("/admin/mod-queue")({ component: ModQueuePage });

function ModQueuePage() {
  const fetchList = useServerFn(listModQueue);
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: "" as "" | "critical" | "high" | "medium" | "low",
    entityType: "",
    status: "open" as "open" | "resolved" | "all",
    assignedTo: "" as "" | "unassigned",
  });
  const [sort, setSort] = useState<{ col: keyof QueueRow; dir: "asc" | "desc" }>({
    col: "priority_score",
    dir: "desc",
  });

  const load = async () => {
    const payload: any = {
      status: filters.status,
      severity: filters.severity || undefined,
      entityType: filters.entityType || undefined,
    };
    if (filters.assignedTo === "unassigned") payload.assignedTo = null;
    const res = await fetchList({ data: payload });
    setItems(res.items as QueueRow[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.severity, filters.entityType, filters.status, filters.assignedTo]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av: any = a[sort.col];
      const bv: any = b[sort.col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [items, sort]);

  const toggleSort = (col: keyof QueueRow) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" }));

  return (
    <div className="text-zinc-200">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-medium text-zinc-100">Moderation Queue</h1>
          <p className="text-xs text-zinc-500">Triage. Decide. Logged forever.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs px-2 py-1 border border-zinc-700 rounded hover:bg-zinc-800"
        >
          Refresh
        </button>
      </header>

      <FiltersBar filters={filters} onChange={setFilters} />

      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400">
            <tr>
              <Th label="Priority" col="severity" sort={sort} onClick={toggleSort} />
              <Th label="Type" col="entity_type" sort={sort} onClick={toggleSort} />
              <th className="text-left font-normal px-2 py-2">Entity</th>
              <Th label="AI rec" col="ai_recommendation" sort={sort} onClick={toggleSort} />
              <Th label="Conf" col="ai_confidence" sort={sort} onClick={toggleSort} />
              <Th label="In queue" col="created_at" sort={sort} onClick={toggleSort} />
              <th className="text-left font-normal px-2 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonRows />
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  Nothing pending. The bench rests.
                </td>
              </tr>
            )}
            {!loading && sorted.map((r) => {
              const sev = SEVERITY_BADGE[r.severity] ?? SEVERITY_BADGE.medium;
              return (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-900/40"
                >
                  <td className="px-2 py-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] ${sev.bg} ${sev.text}`}>
                      <span>{sev.dot}</span>
                      <span>{sev.label}</span>
                      <span className="text-zinc-500">· {r.priority_score}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-zinc-300">{r.entity_type}</td>
                  <td className="px-2 py-2 text-zinc-400 truncate max-w-[280px]">{r.reason}</td>
                  <td className="px-2 py-2 text-zinc-300">{r.ai_recommendation ? ACTION_LABEL[r.ai_recommendation] ?? r.ai_recommendation : "—"}</td>
                  <td className="px-2 py-2 text-zinc-400">{r.ai_confidence != null ? `${Math.round(Number(r.ai_confidence) * 100)}%` : "—"}</td>
                  <td className="px-2 py-2 text-zinc-400">{timeIn(r.created_at)}</td>
                  <td className="px-2 py-2 text-zinc-400">Review →</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId && (
        <DetailPanel id={openId} onClose={() => setOpenId(null)} onResolved={() => { setOpenId(null); load(); }} />
      )}
    </div>
  );
}

function Th({ label, col, sort, onClick }: {
  label: string;
  col: keyof QueueRow;
  sort: { col: keyof QueueRow; dir: "asc" | "desc" };
  onClick: (c: keyof QueueRow) => void;
}) {
  const active = sort.col === col;
  return (
    <th
      onClick={() => onClick(col)}
      className="text-left font-normal px-2 py-2 cursor-pointer select-none hover:text-zinc-200"
    >
      {label} {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t border-zinc-800">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-3 bg-zinc-800 rounded w-20" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FiltersBar({
  filters,
  onChange,
}: {
  filters: { severity: string; entityType: string; status: string; assignedTo: string };
  onChange: (f: any) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <Select
        label="Severity"
        value={filters.severity}
        onChange={(v) => onChange({ ...filters, severity: v })}
        options={[
          { value: "", label: "All" },
          { value: "critical", label: "Critical" },
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ]}
      />
      <Select
        label="Type"
        value={filters.entityType}
        onChange={(v) => onChange({ ...filters, entityType: v })}
        options={[
          { value: "", label: "All" },
          { value: "post", label: "Post" },
          { value: "comment", label: "Comment" },
          { value: "perspective", label: "Perspective" },
          { value: "user", label: "User" },
          { value: "vote_pattern", label: "Vote pattern" },
        ]}
      />
      <Select
        label="Status"
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
        options={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
          { value: "all", label: "All" },
        ]}
      />
      <Select
        label="Assigned"
        value={filters.assignedTo}
        onChange={(v) => onChange({ ...filters, assignedTo: v })}
        options={[
          { value: "", label: "Any" },
          { value: "unassigned", label: "Unassigned" },
        ]}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <span>{label}</span>
      <select
        className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function DetailPanel({ id, onClose, onResolved }: { id: string; onClose: () => void; onResolved: () => void }) {
  const getItem = useServerFn(getModQueueItem);
  const submit = useServerFn(submitModAction);
  const [data, setData] = useState<any>(null);
  const [action, setAction] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setAction("");
    setOverrideReason("");
    setNotes("");
    setError(null);
    getItem({ data: { id } }).then(setData).catch((e) => setError(String(e?.message ?? e)));
  }, [id, getItem]);

  const aiRec = data?.triage?.recommended_action ?? data?.item?.ai_recommendation ?? null;
  const needsOverride = !!aiRec && action && action !== aiRec;
  const banNotesMissing = action === "ban" && !notes.trim();

  const onSubmit = async () => {
    if (!action) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit({
        data: {
          queueItemId: id,
          action: action as any,
          overrideReason: needsOverride ? (overrideReason as any) : null,
          notes: notes.trim() || null,
        },
      });
      onResolved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-[520px] max-w-[90vw] h-full bg-[oklch(0.18_0.01_270)] border-l border-zinc-800 overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-200">Queue item</div>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-100">Close</button>
        </div>

        {!data && !error && <div className="p-4 text-xs text-zinc-500">Pulling the file.</div>}
        {error && <div className="p-4 text-xs text-red-400">{error}</div>}
        {data && (
          <div className="p-4 space-y-4 text-xs text-zinc-300">
            <section>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Entity</div>
              <div className="border border-zinc-800 rounded p-2 bg-zinc-900/40">
                {data.entity?.title && <div className="text-zinc-100 mb-1">{data.entity.title}</div>}
                <div className="whitespace-pre-wrap text-zinc-300">
                  {data.entity?.body || data.entity?.body_text || "(no content)"}
                </div>
              </div>
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">AI triage</div>
              {data.triage || data.item.ai_recommendation ? (
                <div className="border border-zinc-800 rounded p-2 bg-zinc-900/40 space-y-2">
                  <PriorityBar value={data.triage?.priority_score ?? data.item.priority_score} />
                  <div className="flex justify-between text-zinc-400">
                    <span>Confidence</span>
                    <span className="text-zinc-200">
                      {data.triage?.confidence != null
                        ? `${Math.round(Number(data.triage.confidence) * 100)}%`
                        : data.item.ai_confidence != null
                          ? `${Math.round(Number(data.item.ai_confidence) * 100)}%`
                          : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Recommended</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-100">
                      {ACTION_LABEL[aiRec ?? ""] ?? aiRec ?? "—"}
                    </span>
                  </div>
                  <Evidence list={(data.triage?.evidence ?? data.item.ai_evidence ?? []) as any[]} />
                  {(data.triage?.policy_ref ?? data.item.ai_policy_ref) && (
                    <div className="text-zinc-400">
                      Policy: <span className="text-zinc-200 underline">{data.triage?.policy_ref ?? data.item.ai_policy_ref}</span>
                    </div>
                  )}
                  <SimilarCases list={(data.triage?.similar_cases ?? data.item.ai_similar_cases ?? []) as any[]} />
                </div>
              ) : (
                <div className="text-zinc-500">No triage on file.</div>
              )}
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Author</div>
              <div className="border border-zinc-800 rounded p-2 bg-zinc-900/40">
                <div className="text-zinc-100">{data.author?.nickname ?? "anonymous"}{data.author?.handle ? ` · @${data.author.handle}` : ""}</div>
                <div className="text-zinc-400">
                  Joined {data.author?.created_at ? new Date(data.author.created_at).toLocaleDateString() : "—"} ·
                  Prior flags {data.priorFlags} · Prior actions {data.priorActions?.length ?? 0}
                </div>
                {data.priorActions?.length > 0 && (
                  <ul className="mt-1 text-zinc-400 list-disc pl-4">
                    {data.priorActions.slice(0, 3).map((a: any) => (
                      <li key={a.id}>{ACTION_LABEL[a.action] ?? a.action} · {new Date(a.created_at).toLocaleDateString()}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Decision</div>
              <div className="flex flex-wrap gap-1.5">
                {ACTIONS.map((a) => {
                  const active = action === a;
                  const isAi = aiRec === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAction(a)}
                      className={`px-2 py-1 text-[11px] rounded border ${
                        active
                          ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                          : isAi
                            ? "bg-emerald-950/40 border-emerald-900 text-emerald-200"
                            : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {ACTION_LABEL[a]}
                    </button>
                  );
                })}
              </div>

              {needsOverride && (
                <div className="mt-2">
                  <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                    Override reason (required)
                  </label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {OVERRIDE_REASONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-2">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                  Notes {action === "ban" ? "(required)" : "(optional)"}
                </label>
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1 min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="button"
                disabled={
                  !action || submitting ||
                  (needsOverride && !overrideReason) ||
                  banNotesMissing
                }
                onClick={onSubmit}
                className="mt-3 px-3 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded disabled:opacity-50"
              >
                {submitting ? "Recording…" : "Submit decision"}
              </button>
              {error && <div className="mt-2 text-red-400">{error}</div>}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function PriorityBar({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = v >= 75 ? "bg-red-500" : v >= 50 ? "bg-amber-500" : v >= 25 ? "bg-purple-500" : "bg-zinc-500";
  return (
    <div>
      <div className="flex justify-between text-zinc-400">
        <span>Priority</span>
        <span className="text-zinc-200">{v}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded mt-1 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function Evidence({ list }: { list: any[] }) {
  if (!list?.length) return <div className="text-zinc-500">No evidence flags.</div>;
  return (
    <ul className="list-disc pl-4 text-zinc-300">
      {list.map((e, i) => (
        <li key={i}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
      ))}
    </ul>
  );
}

function SimilarCases({ list }: { list: any[] }) {
  if (!list?.length) return null;
  return (
    <div>
      <div className="text-zinc-400 mb-1">Similar past cases</div>
      <ul className="text-zinc-300 space-y-0.5">
        {list.slice(0, 3).map((c, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="truncate">{c.title ?? c.summary ?? c.id ?? "case"}</span>
            <span className="text-zinc-500">{c.outcome ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

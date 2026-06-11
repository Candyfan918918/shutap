// Audit log viewer — read-only. Lists mod_actions with filters + CSV export.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listModActions, listAdminUsersForFilter } from "@/lib/admin/audit-log.functions";

const ACTION_LABEL: Record<string, string> = {
  no_action: "No action",
  warn_user: "Warn",
  remove_content: "Remove",
  suspend_7d: "Suspend 7d",
  ban: "Ban",
  escalate: "Escalate",
  refer_to_legal: "Legal",
};

const ACTIONS = ["no_action","warn_user","remove_content","suspend_7d","ban","escalate","refer_to_legal"] as const;

export const Route = createFileRoute("/admin/audit-log")({ component: AuditLogPage });

function AuditLogPage() {
  const list = useServerFn(listModActions);
  const listAdmins = useServerFn(listAdminUsersForFilter);
  const [items, setItems] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    adminId: "",
    action: "",
    entityType: "",
    from: "",
    to: "",
  });

  useEffect(() => {
    listAdmins({}).then((r) => setAdmins(r.admins ?? [])).catch(() => setAdmins([]));
  }, [listAdmins]);

  const load = async () => {
    setLoading(true);
    const payload: any = {};
    if (filters.adminId) payload.adminId = filters.adminId;
    if (filters.action) payload.action = filters.action;
    if (filters.entityType) payload.entityType = filters.entityType;
    if (filters.from) payload.from = new Date(filters.from).toISOString();
    if (filters.to) payload.to = new Date(filters.to).toISOString();
    const res = await list({ data: payload });
    setItems(res.items);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportCsv = () => {
    const headers = [
      "created_at","admin_email","admin_role","action","ai_recommendation","accepted_ai_rec",
      "override_reason","entity_type","entity_id","queue_item_id","notes"
    ];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((r) => headers.map((h) => escape(r[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mod-actions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="text-zinc-200">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-medium text-zinc-100">Audit log</h1>
          <p className="text-xs text-zinc-500">Append-only. No edits. Ever.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs px-2 py-1 border border-zinc-700 rounded hover:bg-zinc-800">
            Refresh
          </button>
          <button onClick={exportCsv} className="text-xs px-2 py-1 border border-zinc-700 rounded hover:bg-zinc-800">
            Export CSV
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-3 text-xs text-zinc-400">
        <label className="flex items-center gap-2">
          Admin
          <select
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
            value={filters.adminId}
            onChange={(e) => setFilters({ ...filters, adminId: e.target.value })}
          >
            <option value="">All</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Action
          <select
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">All</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Entity
          <select
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
          >
            <option value="">All</option>
            <option value="post">Post</option>
            <option value="comment">Comment</option>
            <option value="perspective">Perspective</option>
            <option value="user">User</option>
            <option value="vote_pattern">Vote pattern</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          From
          <input type="datetime-local" className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
            value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          To
          <input type="datetime-local" className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
            value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <button onClick={load} className="text-xs px-2 py-1 bg-zinc-100 text-zinc-900 rounded">Apply</button>
      </div>

      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400">
            <tr>
              <th className="text-left font-normal px-2 py-2">When</th>
              <th className="text-left font-normal px-2 py-2">Admin</th>
              <th className="text-left font-normal px-2 py-2">Action</th>
              <th className="text-left font-normal px-2 py-2">AI rec</th>
              <th className="text-left font-normal px-2 py-2">Override</th>
              <th className="text-left font-normal px-2 py-2">Entity</th>
              <th className="text-left font-normal px-2 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-2 py-2"><div className="h-3 bg-zinc-800 rounded w-20" /></td>
                  ))}
                </tr>
              ))
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No actions on file.</td></tr>
            )}
            {!loading && items.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="px-2 py-2 text-zinc-400">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-2 py-2 text-zinc-300">{r.admin_email}<div className="text-zinc-500">{r.admin_role}</div></td>
                <td className="px-2 py-2 text-zinc-100">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-2 py-2 text-zinc-400">
                  {r.ai_recommendation ? ACTION_LABEL[r.ai_recommendation] ?? r.ai_recommendation : "—"}
                  {r.ai_recommendation && (
                    <div className={r.accepted_ai_rec ? "text-emerald-400" : "text-amber-400"}>
                      {r.accepted_ai_rec ? "accepted" : "overridden"}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 text-zinc-400">{r.override_reason ?? "—"}</td>
                <td className="px-2 py-2 text-zinc-400">{r.entity_type}<div className="text-zinc-500 truncate max-w-[140px]">{r.entity_id}</div></td>
                <td className="px-2 py-2 text-zinc-400 truncate max-w-[260px]">{r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

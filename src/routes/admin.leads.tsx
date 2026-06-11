import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listLeadPipeline, getLeadDetail, listRevocationQueue, updateRevocation,
  listPartnerPerformance, getComplianceReport,
} from "@/lib/admin/leads.functions";
import { getAdminMe } from "@/lib/admin/auth.functions";

type Tab = "pipeline" | "revocation" | "partners" | "compliance";

const STAGE_LABEL: Record<string, string> = {
  created: "Created",
  consent_verified: "Consent verified",
  sent_to_partner: "Sent to partner",
  booked: "Booked",
  converted: "Converted",
  expired: "Expired",
  revoked: "Revoked",
};

const QUALITY_STYLE: Record<string, string> = {
  hot: "border-red-500/40 text-red-200 bg-red-500/10",
  warm: "border-orange-400/40 text-orange-200 bg-orange-400/10",
  cold: "border-zinc-500/40 text-zinc-300 bg-zinc-500/10",
};

export const Route = createFileRoute("/admin/leads")({
  component: LeadsPage,
});

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function hoursSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function LeadsPage() {
  const me = useServerFn(getAdminMe);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("pipeline");

  useEffect(() => {
    me({}).then((r) => {
      if (!r) { window.location.href = "/admin/login"; return; }
      setAllowed(r.role === "super_admin" || r.role === "partner_manager");
    });
  }, [me]);

  if (allowed === false) return <div className="text-sm text-zinc-400">Not your room.</div>;
  if (allowed === null) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-zinc-100">Lead Management</h1>
        <div className="flex gap-1">
          {(["pipeline", "revocation", "partners", "compliance"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded border ${
                tab === t ? "border-zinc-300 text-zinc-100 bg-zinc-800" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "pipeline" ? "Pipeline" : t === "revocation" ? "Revocation queue" : t === "partners" ? "Partner performance" : "Compliance"}
            </button>
          ))}
        </div>
      </div>

      {tab === "pipeline" && <PipelineBoard />}
      {tab === "revocation" && <RevocationQueue />}
      {tab === "partners" && <PartnerPerformance />}
      {tab === "compliance" && <Compliance />}
    </div>
  );
}

function PipelineBoard() {
  const fetchPipeline = useServerFn(listLeadPipeline);
  const fetchDetail = useServerFn(getLeadDetail);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPipeline({ data: {} }).then((r) => { setData(r); setLoading(false); });
  }, [fetchPipeline]);

  if (loading) return <div className="h-64 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />;
  if (!data) return null;

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {(data.stages as string[]).map((stage) => (
            <div key={stage} className="w-72 shrink-0">
              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 mb-2 flex items-center justify-between">
                <span>{STAGE_LABEL[stage]}</span>
                <span className="text-zinc-600">{(data.byStage[stage] ?? []).length}</span>
              </div>
              <div className="space-y-2">
                {(data.byStage[stage] ?? []).map((l: any) => (
                  <button
                    key={l.id}
                    onClick={async () => {
                      const r = await fetchDetail({ data: { id: l.id } });
                      setSelected(r.lead);
                    }}
                    className="block w-full text-left rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-3 hover:border-zinc-600"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] mb-2">
                      <span className="border border-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded">
                        {l.service_category ?? "unspecified"}
                      </span>
                      {l.lead_quality && (
                        <span className={`border px-1.5 py-0.5 rounded ${QUALITY_STYLE[l.lead_quality] ?? QUALITY_STYLE.cold}`}>
                          {l.lead_quality}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mb-1">{l.city ?? "—"}</div>
                    <div className="text-sm text-zinc-200 line-clamp-3">{l.situation_summary ?? "No summary."}</div>
                    <div className="text-[11px] text-zinc-500 mt-2">
                      {daysSince(l.created_at)}d old
                    </div>
                  </button>
                ))}
                {(data.byStage[stage] ?? []).length === 0 && (
                  <div className="rounded border border-dashed border-zinc-800 px-3 py-4 text-xs text-zinc-600 text-center">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && <LeadDetailSheet lead={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function LeadDetailSheet({ lead, onClose }: { lead: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60" />
      <div
        className="w-[480px] max-w-[90vw] h-full bg-[oklch(0.18_0.01_270)] border-l border-zinc-800 p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-zinc-400">Lead detail</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">×</button>
        </div>
        <div className="space-y-3 text-sm text-zinc-200">
          <Row label="Service">{lead.service_category ?? "—"}</Row>
          <Row label="Quality">{lead.lead_quality ?? "—"}</Row>
          <Row label="City">{lead.city ?? "—"} {lead.country ? `· ${lead.country}` : ""}</Row>
          <Row label="Partner">{lead.partner_name ?? "Unassigned"}</Row>
          <Row label="Stage">{STAGE_LABEL[lead.pipeline_stage] ?? lead.pipeline_stage}</Row>
          <div className="border-t border-zinc-800 pt-3">
            <div className="text-xs text-zinc-500 mb-1">Situation summary</div>
            <p className="leading-relaxed">{lead.situation_summary ?? "—"}</p>
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-1">
            <div className="text-xs text-zinc-500 mb-1">Consent timeline</div>
            <Tl label="Created" iso={lead.created_at} />
            <Tl label="Consent verified" iso={lead.consent_verified_at} />
            <Tl label="Sent to partner" iso={lead.sent_to_partner_at} />
            <Tl label="First contacted" iso={lead.first_contacted_at} />
            <Tl label="Booked" iso={lead.booked_at} />
            <Tl label="Converted" iso={lead.converted_at} />
            <Tl label="Revoked" iso={lead.revoked_at} />
            <Tl label="Partner notified" iso={lead.partner_notified_at} />
            <Tl label="Partner confirmed deletion" iso={lead.partner_confirmed_deleted_at} />
            <Tl label="Resolved" iso={lead.revocation_resolved_at} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200 text-right">{children}</div>
    </div>
  );
}

function Tl({ label, iso }: { label: string; iso?: string | null }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{iso ? new Date(iso).toLocaleString() : "—"}</span>
    </div>
  );
}

function RevocationQueue() {
  const fetchList = useServerFn(listRevocationQueue);
  const act = useServerFn(updateRevocation);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetchList({ data: {} }).then((r) => { setItems(r.items as any[]); setLoading(false); });
  };
  useEffect(() => { refresh(); /* eslint-disable-line */ }, []);

  if (loading) return <div className="h-32 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />;

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-6 text-sm text-zinc-400">
          No revocations open.
        </div>
      )}
      {items.map((l) => {
        const hrs = hoursSince(l.revoked_at) ?? 0;
        const overdue = hrs > 24 && !l.revocation_resolved_at;
        return (
          <div
            key={l.id}
            className={`rounded border p-4 ${overdue ? "border-red-500/60 bg-red-500/5" : "border-zinc-800 bg-[oklch(0.20_0.01_270)]"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                <span className="border border-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded">{l.service_category ?? "—"}</span>
                <span className="text-zinc-500">{l.city ?? "—"}</span>
                <span className="text-zinc-500">· {l.partner_name ?? "Unassigned"}</span>
              </div>
              <span className={`text-xs ${overdue ? "text-red-300" : "text-zinc-400"}`}>
                {hrs}h since revocation {overdue && "· SLA breached"}
              </span>
            </div>
            <p className="text-sm text-zinc-200 mb-3">{l.situation_summary ?? "—"}</p>
            <div className="flex flex-wrap gap-2">
              <ActionBtn
                done={!!l.partner_notified_at}
                onClick={async () => { await act({ data: { id: l.id, action: "partner_notified" } }); refresh(); }}
              >
                {l.partner_notified_at ? "Partner notified ✓" : "Confirm partner notified"}
              </ActionBtn>
              <ActionBtn
                done={!!l.partner_confirmed_deleted_at}
                onClick={async () => { await act({ data: { id: l.id, action: "partner_confirmed_deleted" } }); refresh(); }}
              >
                {l.partner_confirmed_deleted_at ? "Partner confirmed deletion ✓" : "Confirm deleted from partner"}
              </ActionBtn>
              <ActionBtn
                done={!!l.revocation_resolved_at}
                onClick={async () => { await act({ data: { id: l.id, action: "resolved" } }); refresh(); }}
              >
                {l.revocation_resolved_at ? "Resolved ✓" : "Mark resolved"}
              </ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({ children, onClick, done }: { children: React.ReactNode; onClick: () => void; done: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={done}
      className={`text-xs px-3 py-1.5 rounded border ${
        done
          ? "border-emerald-700/40 bg-emerald-700/10 text-emerald-200 cursor-default"
          : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

function PartnerPerformance() {
  const fetchPerf = useServerFn(listPartnerPerformance);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPerf({ data: {} }).then((r) => { setItems(r.items as any[]); setLoading(false); });
  }, [fetchPerf]);

  if (loading) return <div className="h-32 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />;

  return (
    <div className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-zinc-500 bg-[oklch(0.18_0.01_270)]">
          <tr>
            <th className="text-left px-3 py-2">Partner</th>
            <th className="text-right px-3 py-2">Received</th>
            <th className="text-right px-3 py-2">Contacted</th>
            <th className="text-right px-3 py-2">Booking</th>
            <th className="text-right px-3 py-2">Conversion</th>
            <th className="text-right px-3 py-2">Avg days to contact</th>
          </tr>
        </thead>
        <tbody className="text-zinc-200">
          {items.map((p) => {
            const flagged = p.bookingRate < 20 && p.received > 0;
            return (
              <tr key={p.partnerId} className={`border-t border-zinc-800 ${flagged ? "border-l-2 border-l-amber-400" : ""}`}>
                <td className="px-3 py-2">{p.partnerName}</td>
                <td className="px-3 py-2 text-right">{p.received}</td>
                <td className="px-3 py-2 text-right">{p.contactedRate}%</td>
                <td className={`px-3 py-2 text-right ${flagged ? "text-amber-300" : ""}`}>{p.bookingRate}%</td>
                <td className="px-3 py-2 text-right">{p.conversionRate}%</td>
                <td className="px-3 py-2 text-right">{p.avgDaysToContact}</td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-500">No partner activity in the last 90 days.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Compliance() {
  const fetchReport = useServerFn(getComplianceReport);
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReport({ data: { month } }).then((r) => { setRows(r.rows as any[]); setLoading(false); });
  }, [month, fetchReport]);

  function exportCsv() {
    const header = ["id", "stage", "service_category", "partner", "created_at", "consent_verified_at", "sent_to_partner_at", "revoked_at", "revocation_resolved_at"];
    const lines = [header.join(",")].concat(
      rows.map((r) => header.map((k) => {
        const v = (k === "stage" ? r.pipeline_stage : k === "partner" ? r.partner_name : (r as any)[k]) ?? "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `compliance-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const stageCount = (s: string) => rows.filter((r) => r.pipeline_stage === s).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-[oklch(0.20_0.01_270)] border border-zinc-700 text-sm text-zinc-200 px-2 py-1 rounded"
        />
        <button
          onClick={exportCsv}
          className="px-3 py-1 text-xs rounded border border-zinc-700 text-zinc-200 hover:border-zinc-500"
        >
          Export CSV
        </button>
      </div>
      {loading ? (
        <div className="h-32 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Total leads", v: rows.length },
            { l: "Consent verified", v: rows.filter((r) => r.consent_verified_at).length },
            { l: "Sent to partners", v: rows.filter((r) => r.sent_to_partner_at).length },
            { l: "Revoked", v: rows.filter((r) => r.revoked_at).length },
            { l: "Booked", v: stageCount("booked") + stageCount("converted") },
            { l: "Converted", v: stageCount("converted") },
            { l: "Expired", v: stageCount("expired") },
            { l: "Open revocations", v: rows.filter((r) => r.revoked_at && !r.revocation_resolved_at).length },
          ].map((s) => (
            <div key={s.l} className="rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-4">
              <div className="text-xs text-zinc-500">{s.l}</div>
              <div className="text-2xl font-medium text-zinc-100">{s.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

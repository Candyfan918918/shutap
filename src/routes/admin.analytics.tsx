import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAnalytics } from "@/lib/admin/analytics.functions";
import { getAdminMe } from "@/lib/admin/auth.functions";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

type Range = "today" | "7d" | "30d" | "custom";

const CHART_COLOR = "hsl(var(--primary))";
const GRID_COLOR = "oklch(0.30 0.01 270)";
const AXIS_COLOR = "oklch(0.60 0.01 270)";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-[0.18em] text-zinc-500">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Card({ title, children, full = false }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] p-4 ${full ? "md:col-span-2" : ""}`}>
      <div className="text-xs text-zinc-400 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-medium text-zinc-100">
        {value}{suffix ? <span className="text-sm text-zinc-400 ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const me = useServerFn(getAdminMe);
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    me({}).then((r) => {
      if (!r) { window.location.href = "/admin/login"; return; }
      setAllowed(r.role === "super_admin" || r.role === "analyst");
    });
  }, [me]);

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    fetchAnalytics({ data: { range } }).then((d) => { setData(d); setLoading(false); });
  }, [allowed, range, fetchAnalytics]);

  const ranges: Range[] = useMemo(() => ["today", "7d", "30d", "custom"], []);

  if (allowed === false) {
    return <div className="text-sm text-zinc-400">Not your room.</div>;
  }
  if (allowed === null) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-zinc-100">Analytics</h1>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded border ${
                range === r ? "border-zinc-300 text-zinc-100 bg-zinc-800" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {r === "today" ? "Today" : r === "7d" ? "7d" : r === "30d" ? "30d" : "Custom"}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded border border-zinc-800 bg-[oklch(0.20_0.01_270)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <Section title="Growth">
            <Card title="New signups">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.growth.signupSeries}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Line type="monotone" dataKey="count" stroke={CHART_COLOR} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Retention (D1 / D7 / D30)">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.growth.retentionCurve}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} unit="%" />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Line type="monotone" dataKey="pct" stroke={CHART_COLOR} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Top cities/countries">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.growth.topCities} layout="vertical">
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis type="number" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis type="category" dataKey="city" stroke={AXIS_COLOR} fontSize={11} width={130} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Bar dataKey="count" fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Funnel: visit → vote → signup → first post">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.growth.funnel}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="stage" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Bar dataKey="count" fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Section>

          <Section title="Content Health">
            <Card title="Controversy rate (target 30%)">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.content.controversySeries}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <ReferenceLine y={30} stroke="oklch(0.70 0.18 60)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Line type="monotone" dataKey="count" stroke={CHART_COLOR} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Guardian blocks by category">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.content.guardianBlocks}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="cat" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Bar dataKey="count" fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Quality stats" full>
              <div className="grid grid-cols-4 gap-6">
                <Stat label="Comment quality" value={data.content.commentQualityRatio} suffix="%" />
                <Stat label="Outcomes @ 30d" value={data.content.outcomeRate.d30} />
                <Stat label="Outcomes @ 90d" value={data.content.outcomeRate.d90} />
                <Stat label="Outcomes @ 180d" value={data.content.outcomeRate.d180} />
              </div>
            </Card>
          </Section>

          <Section title="Safety">
            <Card title="Moderation actions (30d)" full>
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr><th className="text-left py-1">Action</th><th className="text-right py-1">Count</th></tr>
                </thead>
                <tbody className="text-zinc-200">
                  {data.safety.modActionsByType.map((r: any) => (
                    <tr key={r.type} className="border-t border-zinc-800">
                      <td className="py-1">{r.type}</td>
                      <td className="py-1 text-right">{r.count}</td>
                    </tr>
                  ))}
                  {data.safety.modActionsByType.length === 0 && (
                    <tr><td colSpan={2} className="py-3 text-zinc-500 text-center">No actions in window.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
            <Card title="Avg queue resolution (min)">
              {data.safety.queueResolutionMins.length === 0 ? (
                <div className="text-zinc-500 text-sm">Nothing resolved yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {data.safety.queueResolutionMins.map((r: any) => (
                    <Stat key={r.severity} label={r.severity} value={r.avgMinutes} suffix="min" />
                  ))}
                </div>
              )}
            </Card>
            <Card title="Override & quarantine">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="AI override rate" value={data.safety.overrideRate} suffix="%" />
                <Stat label="Quarantined votes (30d)" value={data.safety.quarantinedVotes} />
              </div>
            </Card>
          </Section>

          <Section title="Revenue">
            <Card title="Lead funnel">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.revenue.leadFunnel}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="stage" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Bar dataKey="count" fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Conversions by category">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.revenue.revenueByCategory}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis dataKey="cat" stroke={AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.01 270)", border: "1px solid oklch(0.30 0.01 270)" }} />
                  <Bar dataKey="conversions" fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Partner performance" full>
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="text-left py-1">Partner</th>
                    <th className="text-right py-1">Received</th>
                    <th className="text-right py-1">Booking rate</th>
                    <th className="text-right py-1">Conversion rate</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {data.revenue.partnerPerformance.map((p: any) => (
                    <tr key={p.partnerId} className="border-t border-zinc-800">
                      <td className="py-1">{p.partnerName}</td>
                      <td className="py-1 text-right">{p.received}</td>
                      <td className="py-1 text-right">{p.bookingRate}%</td>
                      <td className="py-1 text-right">{p.conversionRate}%</td>
                    </tr>
                  ))}
                  {data.revenue.partnerPerformance.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-zinc-500 text-center">No partner data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </Section>
        </>
      )}
    </div>
  );
}

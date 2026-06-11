// /admin — dashboard. Metric cards + polling every 30s.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getDashboardMetrics } from "@/lib/admin/dashboard.functions";
import { MetricCard, MetricCardSkeleton } from "@/components/admin/MetricCard";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardMetrics>> | null>(null);
  const [stamp, setStamp] = useState<Date | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetchMetrics({});
        if (mounted.current) {
          setData(res);
          setStamp(new Date());
        }
      } catch {
        // soft fail — keep last data
      } finally {
        if (mounted.current) timer = setTimeout(tick, 30_000);
      }
    };
    tick();
    return () => { mounted.current = false; clearTimeout(timer!); };
  }, [fetchMetrics]);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-medium text-zinc-100">Operations</h1>
        <div className="text-[11px] text-zinc-500">
          {stamp ? `Updated ${stamp.toLocaleTimeString()}` : "Polling."}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data
          ? data.cards.map((c) => (
              <MetricCard key={c.key} label={c.label} value={c.value} deltaPct={c.deltaPct} />
            ))
          : Array.from({ length: 6 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>

      {data && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(data.role === "super_admin" || data.role === "moderator") && (
            <Link to="/admin/mod-queue" className="rounded border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800">
              Open queue ({data.queueOpen})
            </Link>
          )}
          {(data.role === "super_admin" || data.role === "analyst") && (
            <Link to="/admin/briefing" className="rounded border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800">
              View today's briefing
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

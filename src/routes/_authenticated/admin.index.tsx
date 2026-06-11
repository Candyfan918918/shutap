// /admin — city court toggles + nomination caps.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listCityCourts,
  toggleCityCourt,
  updateCityCourtCap,
  type CityCourtRow,
} from "@/lib/admin/cityCourts.functions";
import { schemaCheck, type SchemaCheckResult } from "@/lib/health/schema-check.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CityCourtsPage,
});

function CityCourtsPage() {
  const list = useServerFn(listCityCourts);
  const toggle = useServerFn(toggleCityCourt);
  const updateCap = useServerFn(updateCityCourtCap);
  const runSchemaCheck = useServerFn(schemaCheck);
  const [rows, setRows] = useState<CityCourtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<SchemaCheckResult | null>(null);

  const refresh = () =>
    list({ data: {} as never })
      .then((r) => setRows(r.rows))
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
    runSchemaCheck({ data: {} as never })
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, missing: [], checked: [], error: (e as Error).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Pulling roster.</p>;

  return (
    <div className="space-y-3">
      {health && !health.ok && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <p className="font-medium">Schema health: failing</p>
          {health.missing.length > 0 && (
            <p className="mt-1">Missing columns on profiles: {health.missing.join(", ")}</p>
          )}
          {health.error && <p className="mt-1 font-mono break-words">{health.error}</p>}
        </div>
      )}
      {health?.ok && (
        <p className="text-[11px] text-muted-foreground">Schema health: ok ({health.checked.length} cols on profiles)</p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No city courts on the record yet.</p>
      ) : (
        <>
      <p className="text-sm text-muted-foreground">
        Toggle a court off to stop nominating cases there. Cap controls how many cases per cron tick.
      </p>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Court</th>
              <th className="text-left px-3 py-2">Country</th>
              <th className="text-left px-3 py-2">Cap</th>
              <th className="text-left px-3 py-2">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.countryCode ?? "—"}</td>
                <td className="px-3 py-2">
                  <CapEditor
                    initial={r.nominationCap}
                    disabled={busy === r.code}
                    onSave={async (next) => {
                      setBusy(r.code);
                      try {
                        await updateCap({ data: { code: r.code, nominationCap: next } });
                        toast.success(`${r.label} cap = ${next}`);
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  {r.active ? (
                    <span className="text-emerald-500">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Paused{r.pausedReason ? ` · ${r.pausedReason}` : ""}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Switch
                    checked={r.active}
                    disabled={busy === r.code}
                    onCheckedChange={async (checked) => {
                      setBusy(r.code);
                      try {
                        const reason = checked
                          ? undefined
                          : window.prompt("Pause reason (shown to other admins)?") ?? "Paused by Bench";
                        await toggle({
                          data: { code: r.code, active: checked, pausedReason: reason },
                        });
                        toast.success(checked ? `${r.label} resumed.` : `${r.label} paused.`);
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

function CapEditor({
  initial,
  disabled,
  onSave,
}: {
  initial: number;
  disabled: boolean;
  onSave: (n: number) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        max={50}
        value={v}
        onChange={(e) => setV(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
        className="w-20 h-8"
        disabled={disabled}
      />
      {v !== initial && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(v)}>
          Save
        </Button>
      )}
    </div>
  );
}

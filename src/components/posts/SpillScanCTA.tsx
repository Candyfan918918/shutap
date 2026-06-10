// SpillScanCTA — inline card surfaced after a user votes. Two clear paths:
// spill your own case, or run a quick scan on a situation.
import { Link } from "@tanstack/react-router";

export function SpillScanCTA() {
  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface-2)" }}
    >
      <p className="text-sm font-medium">Got your own case?</p>
      <p className="text-xs" style={{ color: "var(--c-text-2)" }}>
        The Bench will hear it. Spill the full story, or scan a situation first.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/spill"
          className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium text-center"
        >
          ☕ Spill
        </Link>
        <Link
          to="/scan"
          className="px-3 py-2 rounded-full bg-surface-elevated border border-border text-xs font-medium text-center"
        >
          🔍 Scan
        </Link>
      </div>
    </div>
  );
}

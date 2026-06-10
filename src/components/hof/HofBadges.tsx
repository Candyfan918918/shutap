// HOF badges row for alias profile.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listEntityBadges, type EntityBadge } from "@/lib/hof.functions";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function HofBadges({ userId }: { userId: string }) {
  const fetchBadges = useServerFn(listEntityBadges);
  const q = useQuery({
    queryKey: ["hof_badges", "user", userId],
    queryFn: () => fetchBadges({ data: { entity_type: "user", entity_id: userId } }),
    staleTime: 60_000,
  });

  const badges: EntityBadge[] = q.data?.badges ?? [];
  if (!badges.length) {
    return (
      <div className="px-6 py-10 text-center text-[12px]" style={{ color: "var(--c-text-3)" }}>
        No HOF appearances yet. The Bench is watching.
      </div>
    );
  }
  return (
    <ul className="px-4 py-3 space-y-2">
      {badges.map((b) => (
        <li
          key={b.id}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-amber, #d4a341)" }}
        >
          <span className="text-xl">{b.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px]" style={{ color: "var(--c-text-1)" }}>
              {b.category_label} · {b.period_label} · #{b.rank}
            </p>
            <p className="text-[10.5px]" style={{ color: "var(--c-text-3)" }}>
              {fmtDate(b.awarded_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

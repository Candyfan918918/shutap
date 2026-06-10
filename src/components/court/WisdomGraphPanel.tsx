// WisdomGraphPanel — shows the append-only graph nodes/edges this case has
// produced. Refetches when the page dispatches a 'wg:refresh' event (the
// OutcomePrompt fires it after a successful submit) and on a slow interval
// so AI-written nodes appear without a manual reload.
import { useCallback, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWisdomGraphForPost, type WGNode, type WGEdge } from "@/lib/wisdom-graph.functions";

const TYPE_GLYPH: Record<string, string> = {
  case: "⚖️",
  outcome: "📍",
  category: "🏷️",
  resolved_case: "📚",
};

function nodeLabel(n: WGNode): string {
  const p = (n.payload ?? {}) as Record<string, any>;
  if (n.node_type === "case") return p.title ?? "Case";
  if (n.node_type === "outcome") {
    const t = p.outcome_type ? String(p.outcome_type).replace(/_/g, " ") : "outcome";
    const d = p.days_elapsed != null ? ` · ${p.days_elapsed}d` : "";
    return `${t}${d}`;
  }
  if (n.node_type === "category") return p.label ?? n.category ?? "category";
  if (n.node_type === "resolved_case") return p.community_verdict ?? n.category ?? "resolved";
  return n.node_type;
}

export function WisdomGraphPanel({ postId }: { postId: string }) {
  const fetchGraph = useServerFn(getWisdomGraphForPost);

  const queryFn = useCallback(
    () => fetchGraph({ data: { postId } }),
    [fetchGraph, postId],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wisdom-graph", postId],
    queryFn,
    staleTime: 15_000,
  });

  useEffect(() => {
    const handler = () => { void refetch(); };
    window.addEventListener("wg:refresh", handler);
    const t = window.setInterval(() => { void refetch(); }, 30_000);
    return () => {
      window.removeEventListener("wg:refresh", handler);
      window.clearInterval(t);
    };
  }, [refetch]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, WGNode>();
    (data?.nodes ?? []).forEach((n) => m.set(n.id, n));
    return m;
  }, [data]);

  const nodes = data?.nodes ?? [];
  const edges = (data?.edges ?? []) as WGEdge[];

  if (isLoading) return null;
  if (nodes.length === 0) {
    return (
      <section
        className="rounded-2xl border p-4 sm:p-5"
        style={{ borderColor: "var(--c-border)", background: "var(--c-surface-1)" }}
      >
        <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
          Wisdom Graph
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--c-text-2)" }}>
          No nodes yet. Once the outcome lands, the graph remembers.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: "var(--c-border)", background: "var(--c-surface-1)" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
          Wisdom Graph
        </div>
        <div className="text-[10px]" style={{ color: "var(--c-text-3)" }}>
          {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} edge{edges.length === 1 ? "" : "s"}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {nodes.map((n) => (
          <li
            key={n.id}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "var(--c-text-1)" }}
          >
            <span aria-hidden>{TYPE_GLYPH[n.node_type] ?? "•"}</span>
            <span className="font-medium capitalize">{n.node_type.replace(/_/g, " ")}</span>
            <span style={{ color: "var(--c-text-2)" }}>· {nodeLabel(n)}</span>
          </li>
        ))}
      </ul>

      {edges.length > 0 && (
        <ul className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: "var(--c-border)" }}>
          {edges.map((e) => {
            const f = nodeMap.get(e.from_node);
            const t = nodeMap.get(e.to_node);
            return (
              <li key={e.id} className="text-[12px]" style={{ color: "var(--c-text-2)" }}>
                <span className="capitalize">{f ? nodeLabel(f) : "…"}</span>
                <span className="mx-1.5 opacity-60">— {e.relation.replace(/_/g, " ")} →</span>
                <span className="capitalize">{t ? nodeLabel(t) : "…"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

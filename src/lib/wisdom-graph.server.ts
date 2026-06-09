// Wisdom Graph writer — server-only.
// Runs the `wisdom_graph_writer` agent for a resolved case (post + outcome),
// inserts a node into wisdom_graph_nodes, then connects it to up to 5
// candidate prior nodes via wisdom_graph_edges. Never returns data to clients.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runMoment } from "@/lib/orchestrator.server";

interface AgentNode {
  category?: string | null;
  relationship_type?: string | null;
  conflict_type?: string | null;
  severity?: string | null;
  community_verdict?: string | null;
  judgment_distribution?: Record<string, number> | null;
  outcome_type?: string | null;
  days_to_outcome?: number | null;
  children_involved?: boolean | null;
  financial_entanglement?: boolean | null;
  region?: string | null;
}

interface AgentEdge {
  to_node_id: string;
  edge_type: string;
  weight: number;
}

interface AgentOutput {
  node?: AgentNode;
  edges?: AgentEdge[];
}

export async function writeWisdomGraphForPost(args: {
  postId: string;
  outcomeType: string;
  daysElapsed: number | null;
  userId: string;
}): Promise<{ nodeId: string | null; edgeCount: number }> {
  const { postId, outcomeType, daysElapsed, userId } = args;

  // Pull tags + verdict distribution + case context so the agent has signal.
  const [{ data: post }, { data: tags }, { data: cc }, { data: votes }] = await Promise.all([
    supabaseAdmin
      .from("posts")
      .select("id, author_id")
      .eq("id", postId)
      .maybeSingle(),
    supabaseAdmin
      .from("story_tags")
      .select("tag, source, confidence")
      .eq("story_id", postId)
      .limit(20),
    supabaseAdmin
      .from("court_cases")
      .select("region_label, final_verdict, current_tier")
      .eq("post_id", postId)
      .order("decided_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("post_verdict_votes")
      .select("kind")
      .eq("post_id", postId),
  ]);

  if (!post) return { nodeId: null, edgeCount: 0 };

  const dist: Record<string, number> = {};
  for (const v of (votes ?? []) as any[]) dist[v.kind] = (dist[v.kind] ?? 0) + 1;

  // 5 most recent prior nodes in the same category as candidates for edges.
  const { data: candidates } = await supabaseAdmin
    .from("wisdom_graph_nodes")
    .select("id, category, payload")
    .eq("category", (tags as any)?.category ?? null)
    .order("created_at", { ascending: false })
    .limit(5);

  let agentOut: AgentOutput = {};
  try {
    const result = await runMoment({
      moment: "wisdom_graph",
      payload: {
        story_tags: tags ?? {},
        judgment_distribution: dist,
        community_verdict: cc?.final_verdict ?? null,
        outcome_type: outcomeType,
        days_to_outcome: daysElapsed,
        region: cc?.region_label ?? null,
        candidate_nodes: (candidates ?? []).map((c: any) => ({
          id: c.id,
          category: c.category,
          payload: c.payload,
        })),
      },
      userId,
      storyId: postId,
    });
    agentOut = (result.results[0]?.output ?? {}) as AgentOutput;
  } catch {
    // Fall through with empty agentOut → still write a minimal node so
    // the graph reflects the outcome even when the model errors.
  }

  const node = agentOut.node ?? {};
  const payload = {
    category: node.category ?? (tags as any)?.category ?? null,
    relationship_type: node.relationship_type ?? null,
    conflict_type: node.conflict_type ?? (tags as any)?.conflict_type ?? null,
    severity: node.severity ?? (tags as any)?.severity ?? null,
    community_verdict: node.community_verdict ?? cc?.final_verdict ?? null,
    judgment_distribution: node.judgment_distribution ?? dist,
    outcome_type: node.outcome_type ?? outcomeType,
    days_to_outcome: node.days_to_outcome ?? daysElapsed,
    children_involved: node.children_involved ?? (tags as any)?.children_involved ?? false,
    financial_entanglement:
      node.financial_entanglement ?? (tags as any)?.financial_entanglement ?? false,
    region: node.region ?? cc?.region_label ?? null,
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("wisdom_graph_nodes")
    .insert({
      post_id: postId,
      node_type: "resolved_case",
      category: payload.category,
      payload,
    })
    .select("id")
    .single();

  if (error || !inserted) return { nodeId: null, edgeCount: 0 };
  const nodeId = (inserted as any).id as string;

  const validIds = new Set((candidates ?? []).map((c: any) => c.id as string));
  const edges = (agentOut.edges ?? [])
    .filter((e) => e && validIds.has(e.to_node_id) && Number(e.weight) > 0.6)
    .slice(0, 5);

  let edgeCount = 0;
  for (const e of edges) {
    const { error: ee } = await supabaseAdmin.from("wisdom_graph_edges").insert({
      from_node: nodeId,
      to_node: e.to_node_id,
      relation: String(e.edge_type).slice(0, 64),
      weight: Number(e.weight),
    });
    if (!ee) edgeCount += 1;
  }

  return { nodeId, edgeCount };
}

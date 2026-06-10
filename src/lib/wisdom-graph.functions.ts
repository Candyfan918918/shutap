// Read-only fetch of wisdom graph nodes/edges for a single post.
// Tables are client-blocked by RLS — this server fn uses the admin client
// to return a slim DTO the panel renders.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WGNode = {
  id: string;
  node_type: string;
  category: string | null;
  post_id: string | null;
  payload: any;
  created_at: string;
};
export type WGEdge = {
  id: string;
  from_node: string;
  to_node: string;
  relation: string;
  weight: number | null;
  created_at: string;
};

export const getWisdomGraphForPost = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ nodes: WGNode[]; edges: WGEdge[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Direct nodes for this post (case + outcome rows).
    const { data: postNodes } = await supabaseAdmin
      .from("wisdom_graph_nodes")
      .select("id, node_type, category, post_id, payload, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });

    const seedIds = (postNodes ?? []).map((n: any) => n.id as string);
    if (seedIds.length === 0) return { nodes: [], edges: [] };

    // 2. Edges touching those nodes.
    const { data: edges } = await supabaseAdmin
      .from("wisdom_graph_edges")
      .select("id, from_node, to_node, relation, weight, created_at")
      .or(`from_node.in.(${seedIds.join(",")}),to_node.in.(${seedIds.join(",")})`)
      .order("created_at", { ascending: true });

    // 3. Neighbor nodes (e.g. category nodes connected via edges).
    const neighborIds = Array.from(
      new Set(
        (edges ?? []).flatMap((e: any) => [e.from_node, e.to_node]).filter(
          (id: string) => !seedIds.includes(id),
        ),
      ),
    );
    let neighborNodes: any[] = [];
    if (neighborIds.length > 0) {
      const { data: nn } = await supabaseAdmin
        .from("wisdom_graph_nodes")
        .select("id, node_type, category, post_id, payload, created_at")
        .in("id", neighborIds);
      neighborNodes = nn ?? [];
    }

    return {
      nodes: [...(postNodes ?? []), ...neighborNodes] as WGNode[],
      edges: (edges ?? []) as WGEdge[],
    };
  });


-- 1. Ensure category & case nodes exist; insert outcome node + edges on outcome confirmation.
CREATE OR REPLACE FUNCTION public._wg_on_outcome_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts;
  v_case public.court_cases;
  v_case_node uuid;
  v_outcome_node uuid;
  v_cat_node uuid;
  v_category text;
BEGIN
  SELECT * INTO v_post FROM public.posts WHERE id = NEW.post_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_category := COALESCE(v_post.score_category, 'general');

  -- category node: one per category, no post_id
  SELECT id INTO v_cat_node FROM public.wisdom_graph_nodes
   WHERE node_type = 'category' AND category = v_category AND post_id IS NULL
   LIMIT 1;
  IF v_cat_node IS NULL THEN
    INSERT INTO public.wisdom_graph_nodes (node_type, category, payload, weight)
    VALUES ('category', v_category, jsonb_build_object('label', v_category), 1)
    RETURNING id INTO v_cat_node;
  END IF;

  -- case node: one per post
  SELECT id INTO v_case_node FROM public.wisdom_graph_nodes
   WHERE node_type = 'case' AND post_id = v_post.id LIMIT 1;
  IF v_case_node IS NULL THEN
    SELECT * INTO v_case FROM public.court_cases
     WHERE post_id = v_post.id ORDER BY nominated_at DESC LIMIT 1;
    INSERT INTO public.wisdom_graph_nodes (node_type, post_id, category, payload, weight)
    VALUES ('case', v_post.id, v_category,
      jsonb_build_object(
        'title', v_post.title,
        'final_verdict', v_case.final_verdict,
        'bench_verdict_line', v_case.bench_verdict_line,
        'controversy_score', v_case.controversy_score,
        'current_tier', v_case.current_tier,
        'both_sides_heard', v_post.both_sides_heard,
        'perspective_count', v_post.perspective_count
      ), 1)
    RETURNING id INTO v_case_node;
  END IF;

  -- outcome node: append-only, never updated
  INSERT INTO public.wisdom_graph_nodes (node_type, post_id, category, payload, weight)
  VALUES ('outcome', v_post.id, v_category,
    jsonb_build_object(
      'outcome_type', NEW.outcome_type,
      'detail', NEW.detail,
      'days_elapsed', NEW.days_elapsed,
      'submitted_by', NEW.submitted_by,
      'confirmed_at', NEW.created_at
    ), 1)
  RETURNING id INTO v_outcome_node;

  -- edges: case --resulted_in--> outcome, outcome --in_category--> category
  INSERT INTO public.wisdom_graph_edges (from_node, to_node, relation, weight)
  VALUES (v_case_node, v_outcome_node, 'resulted_in', 1);
  INSERT INTO public.wisdom_graph_edges (from_node, to_node, relation, weight)
  VALUES (v_outcome_node, v_cat_node, 'in_category', 1);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public._wg_on_outcome_confirmed() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_wg_outcome ON public.story_outcomes;
CREATE TRIGGER trg_wg_outcome
AFTER INSERT ON public.story_outcomes
FOR EACH ROW EXECUTE FUNCTION public._wg_on_outcome_confirmed();

-- 2. Append-only enforcement on the graph tables.
REVOKE INSERT, UPDATE, DELETE ON public.wisdom_graph_nodes FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.wisdom_graph_edges FROM anon, authenticated, public;
GRANT INSERT ON public.wisdom_graph_nodes TO service_role;
GRANT INSERT ON public.wisdom_graph_edges TO service_role;

CREATE OR REPLACE FUNCTION public._wg_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'wisdom_graph is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_wg_nodes_append_only ON public.wisdom_graph_nodes;
CREATE TRIGGER trg_wg_nodes_append_only
BEFORE UPDATE OR DELETE ON public.wisdom_graph_nodes
FOR EACH ROW EXECUTE FUNCTION public._wg_append_only();

DROP TRIGGER IF EXISTS trg_wg_edges_append_only ON public.wisdom_graph_edges;
CREATE TRIGGER trg_wg_edges_append_only
BEFORE UPDATE OR DELETE ON public.wisdom_graph_edges
FOR EACH ROW EXECUTE FUNCTION public._wg_append_only();

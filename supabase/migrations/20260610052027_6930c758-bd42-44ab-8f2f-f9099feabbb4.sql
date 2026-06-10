
-- 1) Profiles: revoke column-level SELECT on sensitive fields from anon + authenticated.
REVOKE SELECT (email, phone, dob, dob_month, dob_year, blocked_reason) ON public.profiles FROM anon;
REVOKE SELECT (email, phone, dob, dob_month, dob_year, blocked_reason) ON public.profiles FROM authenticated;

-- 2) Predictions: owner-only reads.
DROP POLICY IF EXISTS predictions_public_read ON public.predictions;
CREATE POLICY predictions_self_read ON public.predictions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS prediction_results_public_read ON public.prediction_results;
CREATE POLICY prediction_results_self_read ON public.prediction_results
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) Remove post_verdict_votes from realtime publication so subscribers can't get
--    cross-user change events. Server reads remain unaffected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'post_verdict_votes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.post_verdict_votes';
  END IF;
END $$;

-- 4) Tables with RLS on and zero policies: add explicit deny-all SELECT for
--    anon/authenticated to document intent. Service role still bypasses RLS.
CREATE POLICY rate_limit_counters_no_client_read ON public.rate_limit_counters
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY reputation_events_no_client_read ON public.reputation_events
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY wisdom_graph_edges_no_client_read ON public.wisdom_graph_edges
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY wisdom_graph_nodes_no_client_read ON public.wisdom_graph_nodes
  FOR SELECT TO anon, authenticated USING (false);

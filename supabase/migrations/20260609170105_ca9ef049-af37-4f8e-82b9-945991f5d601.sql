
-- ─── posts: nomination + lifecycle columns ─────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS nomination_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_vote_sum numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS controversy_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidacy_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cool_down_until timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_at timestamptz,
  ADD COLUMN IF NOT EXISTS drama_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prediction_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relate_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS posts_nomination_score_live_idx
  ON public.posts (nomination_score DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND candidacy_paused = false;

-- ─── court_cases: tier + category + lock + bench line ──────────────────
ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS current_tier text,
  ADD COLUMN IF NOT EXISTS current_category_court text,
  ADD COLUMN IF NOT EXISTS verdict_lock_at timestamptz,
  ADD COLUMN IF NOT EXISTS bench_verdict_line text,
  ADD COLUMN IF NOT EXISTS final_judgment text,
  ADD COLUMN IF NOT EXISTS candidacy_paused boolean NOT NULL DEFAULT false;

UPDATE public.court_cases
SET current_tier = COALESCE(current_tier,
  CASE scope
    WHEN 'city' THEN 'city'
    WHEN 'country' THEN 'national'
    WHEN 'world' THEN 'world'
    ELSE 'city'
  END);

ALTER TABLE public.court_cases
  ADD CONSTRAINT court_cases_current_tier_chk
  CHECK (current_tier IN ('city','regional','national','world'));

CREATE INDEX IF NOT EXISTS court_cases_lock_due_idx
  ON public.court_cases (verdict_lock_at)
  WHERE final_verdict IS NULL;

-- ─── court_tiers: per-tier history ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.court_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('city','regional','national','world')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.court_tiers TO anon, authenticated;
GRANT ALL ON public.court_tiers TO service_role;
ALTER TABLE public.court_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "court_tiers_public_read" ON public.court_tiers FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS court_tiers_case_idx ON public.court_tiers(case_id);

-- ─── city_courts: which cities run their own court ─────────────────────
CREATE TABLE IF NOT EXISTS public.city_courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  country_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.city_courts TO anon, authenticated;
GRANT ALL ON public.city_courts TO service_role;
ALTER TABLE public.city_courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city_courts_public_read" ON public.city_courts FOR SELECT USING (active = true);

-- ─── predictions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  predicted_outcome text NOT NULL,
  confidence smallint NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT SELECT ON public.predictions TO anon;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_public_read" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "predictions_self_write" ON public.predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_self_update" ON public.predictions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "predictions_self_delete" ON public.predictions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── prediction_results ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prediction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_correct boolean NOT NULL,
  scored_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)
);
GRANT SELECT ON public.prediction_results TO anon, authenticated;
GRANT ALL ON public.prediction_results TO service_role;
ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prediction_results_public_read" ON public.prediction_results FOR SELECT USING (true);

-- ─── story_outcomes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.story_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  outcome_type text NOT NULL,
  detail text,
  days_elapsed integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id)
);
GRANT SELECT, INSERT ON public.story_outcomes TO authenticated;
GRANT SELECT ON public.story_outcomes TO anon;
GRANT ALL ON public.story_outcomes TO service_role;
ALTER TABLE public.story_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_outcomes_public_read" ON public.story_outcomes FOR SELECT USING (true);
CREATE POLICY "story_outcomes_author_or_named_party_write" ON public.story_outcomes
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by AND (
      EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.post_perspectives pp
        WHERE pp.post_id = story_outcomes.post_id
          AND pp.responder_id = auth.uid()
          AND pp.standing_status = 'verified'
          AND pp.role = 'named_party'
      )
    )
  );

-- ─── wisdom graph (service role only) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wisdom_graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  node_type text NOT NULL,
  category text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wisdom_graph_nodes TO service_role;
ALTER TABLE public.wisdom_graph_nodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.wisdom_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node uuid NOT NULL REFERENCES public.wisdom_graph_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES public.wisdom_graph_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wisdom_graph_edges TO service_role;
ALTER TABLE public.wisdom_graph_edges ENABLE ROW LEVEL SECURITY;

-- ─── reputation_events (service role only) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.reputation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.court_cases(id) ON DELETE SET NULL,
  delta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reputation_events TO service_role;
ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS reputation_events_user_idx ON public.reputation_events(user_id);

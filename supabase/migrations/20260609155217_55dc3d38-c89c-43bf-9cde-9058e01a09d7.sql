
-- =========================================================================
-- 1. EXTEND EXISTING TABLES
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dob_month int,
  ADD COLUMN IF NOT EXISTS dob_year int,
  ADD COLUMN IF NOT EXISTS account_created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS emotion text,
  ADD COLUMN IF NOT EXISTS creature text,
  ADD COLUMN IF NOT EXISTS juror_title text;

ALTER TABLE public.post_verdict_votes
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS read_depth_percent int,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS quarantined boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pvv_ip_recent
  ON public.post_verdict_votes (ip_hash, created_at)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.post_approvals
  ADD COLUMN IF NOT EXISTS claimer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.safety_events
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz;

-- =========================================================================
-- 2. NEW TABLE: consent  (must exist before leads.consent_id FK)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid,
  service_category text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.consent TO authenticated;
GRANT ALL ON public.consent TO service_role;

ALTER TABLE public.consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_select_own" ON public.consent
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "consent_insert_own" ON public.consent
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consent_update_own" ON public.consent
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consent_id uuid REFERENCES public.consent(id) ON DELETE RESTRICT;

-- =========================================================================
-- 3. NEW TABLE: ai_call_log  (service-role write; users see own rows)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  story_id uuid,
  agent text NOT NULL,
  moment text,
  model text NOT NULL,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_call_log TO authenticated;
GRANT ALL ON public.ai_call_log TO service_role;

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_call_log_select_own" ON public.ai_call_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_user_created
  ON public.ai_call_log (user_id, created_at DESC);

-- =========================================================================
-- 4. NEW TABLES: story_tags / user_tags
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.story_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  tag text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  source text NOT NULL DEFAULT 'tagger',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, tag)
);

GRANT SELECT ON public.story_tags TO authenticated;
GRANT ALL ON public.story_tags TO service_role;

ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_tags_public_read" ON public.story_tags
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_story_tags_story ON public.story_tags (story_id);
CREATE INDEX IF NOT EXISTS idx_story_tags_tag ON public.story_tags (tag);

CREATE TABLE IF NOT EXISTS public.user_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);

GRANT SELECT ON public.user_tags TO authenticated;
GRANT ALL ON public.user_tags TO service_role;

ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tags_select_own" ON public.user_tags
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================================================================
-- 5. NEW TABLES: hof_scores / hof_snapshots  (service-role write)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.hof_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  period text NOT NULL DEFAULT 'all',
  score numeric NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, period)
);

GRANT SELECT ON public.hof_scores TO authenticated;
GRANT ALL ON public.hof_scores TO service_role;

ALTER TABLE public.hof_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hof_scores_public_read" ON public.hof_scores
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_hof_scores_period_score
  ON public.hof_scores (period, score DESC);

CREATE TABLE IF NOT EXISTS public.hof_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hof_snapshots TO authenticated;
GRANT ALL ON public.hof_snapshots TO service_role;

ALTER TABLE public.hof_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hof_snapshots_public_read" ON public.hof_snapshots
  FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- 6. NEW TABLE: outcome_reminders
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.outcome_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  milestone_day int NOT NULL CHECK (milestone_day IN (30, 90, 180, 365)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, milestone_day)
);

GRANT SELECT ON public.outcome_reminders TO authenticated;
GRANT ALL ON public.outcome_reminders TO service_role;

ALTER TABLE public.outcome_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcome_reminders_author_read" ON public.outcome_reminders
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = outcome_reminders.story_id
        AND s.author_id = auth.uid()
    )
  );

-- =========================================================================
-- 7. NEW TABLE: rate_limit_counters  (service-role only)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  UNIQUE (user_id, bucket, window_start)
);

GRANT ALL ON public.rate_limit_counters TO service_role;

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rlc_lookup
  ON public.rate_limit_counters (user_id, bucket, window_start DESC);

-- =========================================================================
-- 8. TRIGGER: updated_at on hof_scores
-- =========================================================================

DROP TRIGGER IF EXISTS trg_hof_scores_updated_at ON public.hof_scores;
CREATE TRIGGER trg_hof_scores_updated_at
  BEFORE UPDATE ON public.hof_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

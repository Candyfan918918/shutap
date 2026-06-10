
-- 1) Add category + daily period support to hof_scores
ALTER TABLE public.hof_scores
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'overall';

-- Drop old unique if exists and recreate including category
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hof_scores_entity_type_entity_id_period_key') THEN
    ALTER TABLE public.hof_scores DROP CONSTRAINT hof_scores_entity_type_entity_id_period_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hof_scores_unique_idx
  ON public.hof_scores (entity_type, entity_id, period, category);

CREATE INDEX IF NOT EXISTS hof_scores_category_period_score_idx
  ON public.hof_scores (category, period, score DESC);

-- 2) hof_snapshots — add category + rank for direct querying
ALTER TABLE public.hof_snapshots
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS rank int,
  ADD COLUMN IF NOT EXISTS score numeric;

CREATE INDEX IF NOT EXISTS hof_snapshots_lookup_idx
  ON public.hof_snapshots (period, category, rank);

-- 3) hof_badges — permanent honors (top-3 placements)
CREATE TABLE IF NOT EXISTS public.hof_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  category text NOT NULL,
  period text NOT NULL,
  period_key text NOT NULL,
  rank int NOT NULL CHECK (rank BETWEEN 1 AND 3),
  emoji text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  snapshot_id uuid REFERENCES public.hof_snapshots(id) ON DELETE SET NULL,
  UNIQUE (entity_type, entity_id, category, period, period_key)
);

GRANT SELECT ON public.hof_badges TO authenticated, anon;
GRANT ALL ON public.hof_badges TO service_role;
ALTER TABLE public.hof_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read HOF badges"
  ON public.hof_badges FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS hof_badges_entity_idx
  ON public.hof_badges (entity_type, entity_id, awarded_at DESC);

-- 4) hof_nominations — user-submitted nominations
CREATE TABLE IF NOT EXISTS public.hof_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, category)
);

GRANT SELECT, INSERT, DELETE ON public.hof_nominations TO authenticated;
GRANT ALL ON public.hof_nominations TO service_role;
ALTER TABLE public.hof_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own nominations"
  ON public.hof_nominations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own nominations"
  ON public.hof_nominations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own nominations"
  ON public.hof_nominations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS hof_nominations_entity_cat_idx
  ON public.hof_nominations (entity_type, entity_id, category);

-- 5) Realtime for hof_scores so leaderboard updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.hof_scores;


-- 1) Extend mod_queue with operational fields
ALTER TABLE public.mod_queue
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS comment_id uuid,
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_policy_ref text,
  ADD COLUMN IF NOT EXISTS ai_similar_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL;

-- Backfill entity_id from post_id where null
UPDATE public.mod_queue SET entity_id = post_id WHERE entity_id IS NULL;

-- Severity check
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mod_queue_severity_check') THEN
    ALTER TABLE public.mod_queue
      ADD CONSTRAINT mod_queue_severity_check
      CHECK (severity IN ('critical','high','medium','low'));
  END IF;
END $$;

-- Entity type check
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mod_queue_entity_type_check') THEN
    ALTER TABLE public.mod_queue
      ADD CONSTRAINT mod_queue_entity_type_check
      CHECK (entity_type IN ('post','comment','perspective','user','vote_pattern'));
  END IF;
END $$;

-- Broaden status set: keep existing values, add 'open' and 'resolved' (we treat pending=open, approved/rejected=resolved)
DO $$ BEGIN
  ALTER TABLE public.mod_queue DROP CONSTRAINT IF EXISTS mod_queue_status_check;
  ALTER TABLE public.mod_queue
    ADD CONSTRAINT mod_queue_status_check
    CHECK (status IN ('pending','open','approved','rejected','resolved','escalated'));
END $$;

CREATE INDEX IF NOT EXISTS idx_mod_queue_open_priority
  ON public.mod_queue (status, priority_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_queue_severity
  ON public.mod_queue (severity, status);

-- 2) AI triage results
CREATE TABLE IF NOT EXISTS public.ai_triage_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('post','comment','perspective','user','vote_pattern')),
  entity_id uuid NOT NULL,
  classifier text NOT NULL,
  model text,
  priority_score integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  recommended_action text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_ref text,
  similar_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_triage_results TO service_role;
ALTER TABLE public.ai_triage_results ENABLE ROW LEVEL SECURITY;
-- No client policies: admin app reads via service role through server fns.

CREATE INDEX IF NOT EXISTS idx_ai_triage_entity ON public.ai_triage_results (entity_type, entity_id, created_at DESC);

-- 3) Append-only mod_actions audit log
CREATE TABLE IF NOT EXISTS public.mod_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  admin_email text NOT NULL,
  admin_role text NOT NULL,
  queue_item_id uuid REFERENCES public.mod_queue(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'no_action','warn_user','remove_content','suspend_7d','ban','escalate','refer_to_legal'
  )),
  ai_recommendation text,
  accepted_ai_rec boolean NOT NULL DEFAULT false,
  override_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mod_actions TO service_role;
ALTER TABLE public.mod_actions ENABLE ROW LEVEL SECURITY;
-- No client policies; admin server fns only.

CREATE INDEX IF NOT EXISTS idx_mod_actions_created ON public.mod_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_admin ON public.mod_actions (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_entity ON public.mod_actions (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_queue ON public.mod_actions (queue_item_id);

-- Enforce append-only at DB level
CREATE OR REPLACE FUNCTION public._mod_actions_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'mod_actions is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_mod_actions_no_update ON public.mod_actions;
CREATE TRIGGER trg_mod_actions_no_update
  BEFORE UPDATE OR DELETE ON public.mod_actions
  FOR EACH ROW EXECUTE FUNCTION public._mod_actions_append_only();

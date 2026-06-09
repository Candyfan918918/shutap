
-- 1) Columns on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS both_sides_heard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS additional_perspectives boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perspective_count integer NOT NULL DEFAULT 0;

-- 2) post_perspectives
CREATE TABLE public.post_perspectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('named_party','participant','witness')),
  standing_status text NOT NULL DEFAULT 'pending'
    CHECK (standing_status IN ('pending','verified','failed')),
  standing_score integer,
  standing_notes text,
  response_text text,
  receipts_urls text[] NOT NULL DEFAULT '{}',
  relate_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, responder_id)
);
CREATE INDEX idx_post_perspectives_post ON public.post_perspectives(post_id);
CREATE INDEX idx_post_perspectives_status ON public.post_perspectives(standing_status);

GRANT SELECT, INSERT, UPDATE ON public.post_perspectives TO authenticated;
GRANT SELECT ON public.post_perspectives TO anon;
GRANT ALL ON public.post_perspectives TO service_role;

ALTER TABLE public.post_perspectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perspectives verified readable"
  ON public.post_perspectives FOR SELECT
  USING (standing_status = 'verified' OR responder_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "perspectives self insert"
  ON public.post_perspectives FOR INSERT TO authenticated
  WITH CHECK (responder_id = auth.uid());

CREATE POLICY "perspectives self update pending"
  ON public.post_perspectives FOR UPDATE TO authenticated
  USING (responder_id = auth.uid() AND locked_at IS NULL)
  WITH CHECK (responder_id = auth.uid());

CREATE TRIGGER trg_post_perspectives_updated_at
  BEFORE UPDATE ON public.post_perspectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Relates
CREATE TABLE public.post_perspective_relates (
  perspective_id uuid NOT NULL REFERENCES public.post_perspectives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perspective_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_perspective_relates TO authenticated;
GRANT SELECT ON public.post_perspective_relates TO anon;
GRANT ALL ON public.post_perspective_relates TO service_role;
ALTER TABLE public.post_perspective_relates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relates readable" ON public.post_perspective_relates FOR SELECT USING (true);
CREATE POLICY "relates self write" ON public.post_perspective_relates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "relates self delete" ON public.post_perspective_relates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4) Comments
CREATE TABLE public.post_perspective_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perspective_id uuid NOT NULL REFERENCES public.post_perspectives(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_pp_comments_perspective ON public.post_perspective_comments(perspective_id);
GRANT SELECT, INSERT, UPDATE ON public.post_perspective_comments TO authenticated;
GRANT SELECT ON public.post_perspective_comments TO anon;
GRANT ALL ON public.post_perspective_comments TO service_role;
ALTER TABLE public.post_perspective_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_comments readable" ON public.post_perspective_comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "pp_comments self insert" ON public.post_perspective_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "pp_comments self update" ON public.post_perspective_comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- 5) Verdicts (sub-thread)
CREATE TABLE public.post_perspective_verdicts (
  perspective_id uuid NOT NULL REFERENCES public.post_perspectives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perspective_id, user_id)
);
CREATE INDEX idx_pp_verdicts_perspective ON public.post_perspective_verdicts(perspective_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_perspective_verdicts TO authenticated;
GRANT SELECT ON public.post_perspective_verdicts TO anon;
GRANT ALL ON public.post_perspective_verdicts TO service_role;
ALTER TABLE public.post_perspective_verdicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_verdicts readable" ON public.post_perspective_verdicts FOR SELECT USING (true);
CREATE POLICY "pp_verdicts self write" ON public.post_perspective_verdicts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp_verdicts self update" ON public.post_perspective_verdicts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6) Standing verification audit
CREATE TABLE public.standing_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perspective_id uuid NOT NULL REFERENCES public.post_perspectives(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL DEFAULT 1,
  claimed_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_output jsonb,
  decision text NOT NULL CHECK (decision IN ('verified','failed','pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_standing_verif_perspective ON public.standing_verifications(perspective_id);
GRANT SELECT, INSERT ON public.standing_verifications TO authenticated;
GRANT ALL ON public.standing_verifications TO service_role;
ALTER TABLE public.standing_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standing self readable" ON public.standing_verifications FOR SELECT
  USING (responder_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "standing self insert" ON public.standing_verifications FOR INSERT TO authenticated
  WITH CHECK (responder_id = auth.uid());

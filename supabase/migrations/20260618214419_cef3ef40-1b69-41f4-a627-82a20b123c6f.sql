
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS bench_seed_lean text,
  ADD COLUMN IF NOT EXISTS bench_seed_verdict_tag text,
  ADD COLUMN IF NOT EXISTS bench_seed_comment text,
  ADD COLUMN IF NOT EXISTS bench_seed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bench_objection_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bench_objection_response jsonb,
  ADD COLUMN IF NOT EXISTS bench_overturned_outcome text,
  ADD COLUMN IF NOT EXISTS bench_overturned_comment text,
  ADD COLUMN IF NOT EXISTS bench_overturned_at timestamptz,
  ADD COLUMN IF NOT EXISTS safety_risk_type text,
  ADD COLUMN IF NOT EXISTS safety_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_response_comment text;

ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS bench_label text,
  ADD COLUMN IF NOT EXISTS bench_read text,
  ADD COLUMN IF NOT EXISTS bench_share_line text,
  ADD COLUMN IF NOT EXISTS bench_lean text;

ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS bench_promotion_line text,
  ADD COLUMN IF NOT EXISTS bench_promotion_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bench_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  comment text NOT NULL,
  cta_label text NOT NULL,
  shown_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.bench_followups TO authenticated;
GRANT ALL ON public.bench_followups TO service_role;

ALTER TABLE public.bench_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads bench followup" ON public.bench_followups;
CREATE POLICY "owner reads bench followup"
  ON public.bench_followups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

DROP POLICY IF EXISTS "owner dismisses bench followup" ON public.bench_followups;
CREATE POLICY "owner dismisses bench followup"
  ON public.bench_followups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

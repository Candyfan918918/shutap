
CREATE TABLE public.scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  current_step integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  flow_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer,
  subscores jsonb,
  category text,
  percentile integer,
  tags text[] NOT NULL DEFAULT '{}',
  badges text[] NOT NULL DEFAULT '{}',
  post_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_scan_results_user_created ON public.scan_results (user_id, created_at DESC);
CREATE INDEX idx_scan_results_status ON public.scan_results (status);

ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scans owner insert"
  ON public.scan_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scans owner update"
  ON public.scan_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "scans owner delete"
  ON public.scan_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "scans readable"
  ON public.scan_results FOR SELECT
  USING (status = 'completed' OR auth.uid() = user_id);

CREATE TRIGGER trg_scan_results_updated_at
  BEFORE UPDATE ON public.scan_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

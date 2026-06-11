
-- Lead pipeline fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'created'
  CHECK (pipeline_stage IN ('created','consent_verified','sent_to_partner','booked','converted','expired','revoked'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_category text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_quality text
  CHECK (lead_quality IS NULL OR lead_quality IN ('cold','warm','hot'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS situation_summary text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS consent_verified_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sent_to_partner_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS booked_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_notified_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_confirmed_deleted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revocation_resolved_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_revoked_at ON public.leads (revoked_at) WHERE revoked_at IS NOT NULL;

-- Admin briefings
CREATE TABLE IF NOT EXISTS public.admin_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL,
  priority text NOT NULL CHECK (priority IN ('critical','high','medium','opportunity')),
  category text NOT NULL CHECK (category IN ('safety','moderation','growth','content','revenue','lead')),
  title text NOT NULL,
  detail text NOT NULL,
  recommendation text,
  metric jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_briefings TO service_role;
ALTER TABLE public.admin_briefings ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: admin app reaches this only via service-role server functions.
CREATE INDEX IF NOT EXISTS idx_admin_briefings_date ON public.admin_briefings (briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_admin_briefings_cat ON public.admin_briefings (category);

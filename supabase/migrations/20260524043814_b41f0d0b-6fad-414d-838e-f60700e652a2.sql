
-- ============================================================
-- Private lead tracking + intent pipeline
-- ============================================================

-- Enum of intent types ("what do you actually need right now?")
DO $$ BEGIN
  CREATE TYPE public.intent_kind AS ENUM (
    'reactions',       -- ☕ Just reactions
    'support',         -- 🫂 Emotional support
    'documentation',   -- 📝 Documentation help
    'legal',           -- ⚖️ Might need legal guidance
    'next_steps'       -- 💔 Next-step help
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_temperature AS ENUM ('cold','early','warm','hot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per intent submission
CREATE TABLE IF NOT EXISTS public.professional_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid,
  scan_id uuid,
  intent intent_kind NOT NULL,
  urgency integer NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  note text,
  lead_score integer NOT NULL DEFAULT 0,
  lead_temperature lead_temperature NOT NULL DEFAULT 'early',
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intents_user ON public.professional_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_intents_score ON public.professional_intents(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_intents_intent ON public.professional_intents(intent);
CREATE INDEX IF NOT EXISTS idx_intents_created ON public.professional_intents(created_at DESC);

ALTER TABLE public.professional_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intents owner insert"
ON public.professional_intents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intents owner select"
ON public.professional_intents FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "intents admin update"
ON public.professional_intents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Permission-gated contact info. Strictly opt-in.
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intent_id uuid REFERENCES public.professional_intents(id) ON DELETE SET NULL,
  email text,
  phone text,
  city text,
  country_code text,
  help_type intent_kind,
  notes text,
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','closed','spam')),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_user ON public.lead_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_status ON public.lead_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_created ON public.lead_contacts(created_at DESC);

ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_contacts owner insert"
ON public.lead_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id AND consent_given = true);

CREATE POLICY "lead_contacts owner select"
ON public.lead_contacts FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "lead_contacts admin update"
ON public.lead_contacts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_lead_contacts_updated
BEFORE UPDATE ON public.lead_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

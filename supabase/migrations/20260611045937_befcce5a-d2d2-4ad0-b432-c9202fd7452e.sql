
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('super_admin','moderator','analyst','partner_manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  totp_secret text NOT NULL,
  role public.admin_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No policies: end-users have zero access. Service role bypasses RLS.

-- Onboarding hardening: track blocked accounts (e.g. underage) instead of deleting auth users,
-- and enforce alias uniqueness at the database level so the claim handler can race-safely retry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_alias_unique
  ON public.profiles (nationality, emotion, creature)
  WHERE nationality IS NOT NULL
    AND emotion IS NOT NULL
    AND creature IS NOT NULL;
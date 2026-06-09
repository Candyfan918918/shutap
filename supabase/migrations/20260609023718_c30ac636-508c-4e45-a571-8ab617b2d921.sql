ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS emotion text,
  ADD COLUMN IF NOT EXISTS creature text,
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS reroll_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_alias_combo_idx
  ON public.profiles (nationality, emotion, creature)
  WHERE nationality IS NOT NULL AND emotion IS NOT NULL AND creature IS NOT NULL;
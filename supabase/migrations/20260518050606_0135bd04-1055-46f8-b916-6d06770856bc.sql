-- Extend profiles with identity columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS vibe text,
  ADD COLUMN IF NOT EXISTS descriptor text,
  ADD COLUMN IF NOT EXISTS city_label text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Replace the new-user trigger so it also captures email and keeps locale/nickname seeding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_locale TEXT;
  v_nick TEXT;
BEGIN
  v_locale := COALESCE(NEW.raw_user_meta_data->>'locale', 'en');

  SELECT text INTO v_nick
  FROM public.nicknames
  WHERE locale = v_locale
  ORDER BY random()
  LIMIT 1;
  IF v_nick IS NULL THEN
    SELECT text INTO v_nick FROM public.nicknames WHERE locale = 'en' ORDER BY random() LIMIT 1;
  END IF;
  IF v_nick IS NULL THEN
    v_nick := 'Anonymous_' || substr(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (id, nickname, locale, email)
  VALUES (NEW.id, v_nick, v_locale, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $function$;

-- Make sure the trigger is wired on auth.users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
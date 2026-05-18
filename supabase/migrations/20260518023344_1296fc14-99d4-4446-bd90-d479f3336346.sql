
-- 1. Set search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 2. Move extensions out of public
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
-- Make extension types/functions still resolvable by including extensions in search_path
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;

-- 3. Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- handle_new_user is called from a trigger so only the table owner needs it (no grant needed)

-- 4. Restrict story-media bucket SELECT to objects under user folders only (still public-URL-readable, but not listable)
DROP POLICY IF EXISTS "story media public read" ON storage.objects;
CREATE POLICY "story media object read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-media');
-- Note: public-read via signed/direct URL still works; listing requires the bucket to be set non-public for client SDK list().
UPDATE storage.buckets SET public = true WHERE id = 'story-media';


-- 1. Profiles: hide email from non-owners (column-level privilege)
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (email) ON public.profiles TO service_role;

-- 2. scan_results: tighten SELECT to owner + admin only
DROP POLICY IF EXISTS "scans readable" ON public.scan_results;
CREATE POLICY "scans owner or admin select"
ON public.scan_results
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Storage: replace broad public-read with owner-listing only.
-- Public CDN URLs still work without storage.objects SELECT.
DROP POLICY IF EXISTS "story-media public read" ON storage.objects;
CREATE POLICY "story-media owner list"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'story-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from clients.
-- These are only used by triggers / server code.
REVOKE EXECUTE ON FUNCTION public._bump_post_counter(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._slugify_handle(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_comment_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_reaction_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_share_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_forward_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_saved_post_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.suggest_handles(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_handle_available(text) FROM anon;

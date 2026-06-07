
-- 1. Revoke public SELECT on profiles.email column
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;

-- 2. Drop the broad storage upload policy (keeping the path-scoped one)
DROP POLICY IF EXISTS "story media authenticated upload" ON storage.objects;

-- 3. Restrict post_reactions SELECT to the reacting user (counts come from admin queries)
DROP POLICY IF EXISTS "reactions readable" ON public.post_reactions;
CREATE POLICY "reactions owner select" ON public.post_reactions
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Restrict post_verdict_votes SELECT to voter or post author
DROP POLICY IF EXISTS "verdicts readable" ON public.post_verdict_votes;
CREATE POLICY "verdicts voter or post author select" ON public.post_verdict_votes
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_verdict_votes.post_id AND p.author_id = auth.uid())
  );

-- 5. Restrict post_comment_reactions SELECT to the reacting user
DROP POLICY IF EXISTS "pcr readable" ON public.post_comment_reactions;
CREATE POLICY "pcr owner select" ON public.post_comment_reactions
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Add parent-post visibility guard to the "author/post-owner read all" comments policy
DROP POLICY IF EXISTS "comments author or post-owner read all" ON public.post_comments;
CREATE POLICY "comments author or post-owner read all" ON public.post_comments
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND p.author_id = auth.uid()
        AND p.deleted_at IS NULL
        AND p.status = 'published'::post_status
    )
  );


-- comments: remove broad public read; restrict to owner/admin
DROP POLICY IF EXISTS "comments published readable" ON public.comments;
CREATE POLICY "comments owner or admin readable"
  ON public.comments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- post_verdict_votes: voter only (no author read of ip_hash etc.)
DROP POLICY IF EXISTS "verdicts voter or post author select" ON public.post_verdict_votes;
CREATE POLICY "verdicts voter select"
  ON public.post_verdict_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- story_tags: published-story reads OR owner/admin
DROP POLICY IF EXISTS story_tags_public_read ON public.story_tags;
CREATE POLICY story_tags_published_or_owner_read
  ON public.story_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_tags.story_id
        AND (s.status = 'published'::story_status
             OR s.author_id = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

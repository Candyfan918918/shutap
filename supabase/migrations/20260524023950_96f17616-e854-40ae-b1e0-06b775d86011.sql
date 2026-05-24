-- ---------- posts: new columns ----------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_trending
  ON public.posts (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND visibility = 'public';

-- ---------- post_comments ----------
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON public.post_comments(user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments readable"
  ON public.post_comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
        AND (p.visibility = 'public'
             OR auth.uid() = p.author_id
             OR (p.visibility = 'friends' AND public.is_friend(auth.uid(), p.author_id)))
    )
  );

CREATE POLICY "comments author or post-owner read all"
  ON public.post_comments FOR SELECT
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.author_id = auth.uid())
  );

CREATE POLICY "comments owner insert"
  ON public.post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "comments owner update"
  ON public.post_comments FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "comments owner or post-owner delete"
  ON public.post_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.author_id = auth.uid())
  );

CREATE TRIGGER trg_post_comments_updated
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comment count maintenance
CREATE OR REPLACE FUNCTION public._on_post_comment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL AND NEW.status = 'published' THEN
      PERFORM public._bump_post_counter(NEW.post_id, 'comment_count', 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.deleted_at IS NULL AND OLD.status = 'published')
       AND (NEW.deleted_at IS NOT NULL OR NEW.status <> 'published') THEN
      PERFORM public._bump_post_counter(NEW.post_id, 'comment_count', -1);
    ELSIF (OLD.deleted_at IS NOT NULL OR OLD.status <> 'published')
       AND (NEW.deleted_at IS NULL AND NEW.status = 'published') THEN
      PERFORM public._bump_post_counter(NEW.post_id, 'comment_count', 1);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL AND OLD.status = 'published' THEN
      PERFORM public._bump_post_counter(OLD.post_id, 'comment_count', -1);
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_post_comments_counter
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public._on_post_comment_change();

-- ---------- post_verdict_votes ----------
CREATE TABLE IF NOT EXISTS public.post_verdict_votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('red_flag','green_flag','run','talk_it_out','lawyer_up','therapy_might_help','need_update')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_verdict_votes_post ON public.post_verdict_votes(post_id, kind);

ALTER TABLE public.post_verdict_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verdicts readable"
  ON public.post_verdict_votes FOR SELECT USING (true);

CREATE POLICY "verdicts owner insert"
  ON public.post_verdict_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verdicts owner update"
  ON public.post_verdict_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "verdicts owner delete"
  ON public.post_verdict_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------- aggregate view for verdict counts ----------
CREATE OR REPLACE VIEW public.post_verdict_counts AS
SELECT post_id, kind, COUNT(*)::int AS count
FROM public.post_verdict_votes
GROUP BY post_id, kind;

GRANT SELECT ON public.post_verdict_counts TO anon, authenticated;
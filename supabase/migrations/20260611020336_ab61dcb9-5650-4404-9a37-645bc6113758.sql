
-- Comments depth
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS is_same_situation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_counsel_pick boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS changed_minds_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_post_comments_counsel_pick
  ON public.post_comments (post_id) WHERE is_counsel_pick = true;
CREATE INDEX IF NOT EXISTS idx_post_comments_same_situation
  ON public.post_comments (post_id) WHERE is_same_situation = true;

-- Allow extra comment reaction kinds. The column is text, no enum to alter.
-- (post_comment_reactions.kind already accepts arbitrary text; the app
-- previously restricted to 'like' | 'funny'. We extend the app contract.)

-- Sequel / case-closed FKs on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS sequel_of uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_closed_of uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS case_closed_summary text;

CREATE INDEX IF NOT EXISTS idx_posts_sequel_of ON public.posts (sequel_of) WHERE sequel_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_case_closed_of ON public.posts (case_closed_of) WHERE case_closed_of IS NOT NULL;

-- Cached AI summary of comments
CREATE TABLE IF NOT EXISTS public.comment_ai_summaries (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  majority_theme text,
  minority_theme text,
  majority_verdict text,
  comment_count_at_gen integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

GRANT SELECT ON public.comment_ai_summaries TO anon, authenticated;
GRANT ALL ON public.comment_ai_summaries TO service_role;
ALTER TABLE public.comment_ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "summaries readable on public posts"
  ON public.comment_ai_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comment_ai_summaries.post_id
        AND p.status = 'published'
        AND p.visibility = 'public'
        AND p.deleted_at IS NULL
    )
  );

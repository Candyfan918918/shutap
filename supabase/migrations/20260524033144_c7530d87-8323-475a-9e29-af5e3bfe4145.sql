
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funny_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.post_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('like','funny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_pcr_comment ON public.post_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_pcr_user ON public.post_comment_reactions(user_id);

ALTER TABLE public.post_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcr readable" ON public.post_comment_reactions FOR SELECT USING (true);
CREATE POLICY "pcr owner insert" ON public.post_comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pcr owner delete" ON public.post_comment_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public._bump_comment_counter(_comment_id uuid, _col text, _delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  EXECUTE format('UPDATE public.post_comments SET %I = GREATEST(0, %I + $1) WHERE id = $2', _col, _col)
    USING _delta, _comment_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public._on_post_comment_reaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE col text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    col := CASE NEW.kind WHEN 'like' THEN 'like_count' WHEN 'funny' THEN 'funny_count' END;
    PERFORM public._bump_comment_counter(NEW.comment_id, col, 1);
  ELSIF TG_OP = 'DELETE' THEN
    col := CASE OLD.kind WHEN 'like' THEN 'like_count' WHEN 'funny' THEN 'funny_count' END;
    PERFORM public._bump_comment_counter(OLD.comment_id, col, -1);
  END IF;
  RETURN NULL;
END
$fn$;

DROP TRIGGER IF EXISTS trg_post_comment_reaction_change ON public.post_comment_reactions;
CREATE TRIGGER trg_post_comment_reaction_change
AFTER INSERT OR DELETE ON public.post_comment_reactions
FOR EACH ROW EXECUTE FUNCTION public._on_post_comment_reaction_change();

REVOKE EXECUTE ON FUNCTION public._bump_comment_counter(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_comment_reaction_change() FROM PUBLIC, anon, authenticated;

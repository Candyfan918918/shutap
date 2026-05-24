
CREATE TABLE IF NOT EXISTS public.daily_cases (
  case_date date PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  headline text,
  subheadline text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_cases_post ON public.daily_cases(post_id);

ALTER TABLE public.daily_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily cases readable" ON public.daily_cases FOR SELECT USING (true);
CREATE POLICY "daily cases admin write" ON public.daily_cases FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_daily_cases_updated_at
BEFORE UPDATE ON public.daily_cases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks owner read" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Picks the case for the given date. If none exists, selects the top engaging
-- public post from the previous 48 hours that isn't already used as a case.
CREATE OR REPLACE FUNCTION public.ensure_daily_case(_date date)
RETURNS public.daily_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  existing public.daily_cases;
  pick uuid;
BEGIN
  SELECT * INTO existing FROM public.daily_cases WHERE case_date = _date;
  IF FOUND THEN RETURN existing; END IF;

  SELECT p.id INTO pick
  FROM public.posts p
  WHERE p.status = 'published'
    AND p.visibility = 'public'
    AND p.deleted_at IS NULL
    AND p.published_at >= (_date::timestamptz - interval '48 hours')
    AND NOT EXISTS (SELECT 1 FROM public.daily_cases dc WHERE dc.post_id = p.id)
  ORDER BY (coalesce(p.comment_count,0)*3 + coalesce(p.like_count,0)*2 + coalesce(p.share_count,0)*2 + coalesce(p.save_count,0) + coalesce(p.view_count,0)/10) DESC,
           p.published_at DESC
  LIMIT 1;

  IF pick IS NULL THEN
    SELECT p.id INTO pick
    FROM public.posts p
    WHERE p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.daily_cases dc WHERE dc.post_id = p.id)
    ORDER BY (coalesce(p.comment_count,0)*3 + coalesce(p.like_count,0)*2 + coalesce(p.share_count,0)*2 + coalesce(p.save_count,0) + coalesce(p.view_count,0)/10) DESC,
             p.published_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF pick IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.daily_cases (case_date, post_id, headline, subheadline)
  VALUES (_date, pick, '⚖️ Daily Relationship Court™', 'Today''s case… who''s actually wrong here?')
  RETURNING * INTO existing;
  RETURN existing;
END
$fn$;

-- Bumps a user's daily participation streak. Called from server functions.
CREATE OR REPLACE FUNCTION public.bump_streak(_user_id uuid, _today date)
RETURNS public.user_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  row public.user_streaks;
  next_current integer;
BEGIN
  SELECT * INTO row FROM public.user_streaks WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_active_date)
    VALUES (_user_id, 1, 1, _today)
    RETURNING * INTO row;
    RETURN row;
  END IF;

  IF row.last_active_date = _today THEN
    RETURN row;
  ELSIF row.last_active_date = _today - 1 THEN
    next_current := row.current_streak + 1;
  ELSE
    next_current := 1;
  END IF;

  UPDATE public.user_streaks
  SET current_streak = next_current,
      longest_streak = GREATEST(longest_streak, next_current),
      last_active_date = _today
  WHERE user_id = _user_id
  RETURNING * INTO row;
  RETURN row;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.ensure_daily_case(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_streak(uuid, date) FROM PUBLIC, anon, authenticated;

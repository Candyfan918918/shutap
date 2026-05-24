
-- Enable scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- court_cases
-- ============================================================
CREATE TABLE public.court_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('city','country','world')),
  region_code text NOT NULL,
  region_label text NOT NULL,
  status text NOT NULL DEFAULT 'nominated'
    CHECK (status IN ('nominated','in_court','judgment_pending','decided','legendary')),
  nominated_at timestamptz NOT NULL DEFAULT now(),
  opens_at timestamptz,
  closes_at timestamptz,
  decided_at timestamptz,
  final_verdict text,
  ai_summary text,
  engagement_score integer NOT NULL DEFAULT 0,
  controversy_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, scope, region_code)
);

CREATE INDEX idx_court_cases_status ON public.court_cases(status);
CREATE INDEX idx_court_cases_scope_region ON public.court_cases(scope, region_code);
CREATE INDEX idx_court_cases_post ON public.court_cases(post_id);
CREATE INDEX idx_court_cases_closes_at ON public.court_cases(closes_at);

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "court_cases readable"
  ON public.court_cases FOR SELECT USING (true);

CREATE POLICY "court_cases admin write"
  ON public.court_cases FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_court_cases_updated_at
  BEFORE UPDATE ON public.court_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- court_case_badges  (honor board)
-- ============================================================
CREATE TABLE public.court_case_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  case_id uuid REFERENCES public.court_cases(id) ON DELETE CASCADE,
  badge_kind text NOT NULL,
  region_label text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  earned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_court_case_badges_author ON public.court_case_badges(author_id);
CREATE INDEX idx_court_case_badges_post ON public.court_case_badges(post_id);

ALTER TABLE public.court_case_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "court_case_badges readable"
  ON public.court_case_badges FOR SELECT USING (true);

CREATE POLICY "court_case_badges author pin"
  ON public.court_case_badges FOR UPDATE
  USING (auth.uid() = author_id);

-- ============================================================
-- nominate_court_cases  — scan top trending and insert nominees
-- ============================================================
CREATE OR REPLACE FUNCTION public.nominate_court_cases(
  _scope text,
  _region_code text,
  _region_label text,
  _limit int DEFAULT 5
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS post_id,
           (coalesce(p.comment_count,0)*3
            + coalesce(p.like_count,0)*2
            + coalesce(p.share_count,0)*2
            + coalesce(p.save_count,0)
            + coalesce(p.view_count,0)/10) AS engagement
    FROM public.posts p
    WHERE p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      AND p.published_at >= now() - interval '72 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.court_cases cc
        WHERE cc.post_id = p.id AND cc.scope = _scope AND cc.region_code = _region_code
      )
    ORDER BY engagement DESC, p.published_at DESC
    LIMIT _limit
  LOOP
    INSERT INTO public.court_cases
      (post_id, scope, region_code, region_label, status, engagement_score)
    VALUES
      (r.post_id, _scope, _region_code, _region_label, 'nominated', r.engagement)
    ON CONFLICT (post_id, scope, region_code) DO NOTHING;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END $$;

-- ============================================================
-- promote_court_cases  — move nominees into active court (24h window)
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_court_cases()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT cc.id, cc.post_id, cc.region_label, p.author_id
    FROM public.court_cases cc
    JOIN public.posts p ON p.id = cc.post_id
    WHERE cc.status = 'nominated'
      AND cc.nominated_at <= now() - interval '30 minutes'
  LOOP
    UPDATE public.court_cases
       SET status = 'in_court',
           opens_at = now(),
           closes_at = now() + interval '24 hours'
     WHERE id = r.id;

    -- Notify author: entered court
    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (
      r.author_id,
      'court_entered',
      jsonb_build_object(
        'case_id', r.id,
        'post_id', r.post_id,
        'region_label', r.region_label,
        'message', '👀 Your story entered ' || r.region_label || ' Court.'
      )
    );

    -- Award initial badge
    INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
    VALUES (r.post_id, r.author_id, r.id, 'court_featured', r.region_label);

    promoted := promoted + 1;
  END LOOP;
  RETURN promoted;
END $$;

-- ============================================================
-- finalize_court_cases  — close cases past their countdown
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_court_cases()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  finalized int := 0;
  r record;
  v_kind text;
  v_count int;
  v_total int;
  v_pct int;
  v_summary text;
  v_badge text;
  v_author uuid;
BEGIN
  FOR r IN
    SELECT cc.id, cc.post_id, cc.region_label, cc.scope, p.author_id
    FROM public.court_cases cc
    JOIN public.posts p ON p.id = cc.post_id
    WHERE cc.status = 'in_court'
      AND cc.closes_at <= now()
  LOOP
    v_author := r.author_id;

    SELECT kind, cnt INTO v_kind, v_count
    FROM (
      SELECT kind, count(*) AS cnt
      FROM public.post_verdict_votes
      WHERE post_id = r.post_id
      GROUP BY kind
      ORDER BY cnt DESC
      LIMIT 1
    ) t;

    SELECT count(*) INTO v_total
    FROM public.post_verdict_votes WHERE post_id = r.post_id;

    IF v_total IS NULL OR v_total = 0 THEN
      v_kind := 'no_verdict';
      v_pct := 0;
    ELSE
      v_pct := round((v_count::numeric / v_total::numeric) * 100);
    END IF;

    v_summary := CASE v_kind
      WHEN 'red_flag' THEN '🚩 Final Verdict: RED FLAG. ' || v_pct || '% of the jury called it. The internet has spoken 😭'
      WHEN 'green_flag' THEN '💚 Final Verdict: GREEN FLAG. ' || v_pct || '% says keep them.'
      WHEN 'run' THEN '🏃 Final Verdict: RUN. ' || v_pct || '% of the internet agrees.'
      WHEN 'talk' THEN '🗣 Final Verdict: Talk It Out. This one deserves one honest conversation.'
      WHEN 'lawyer' THEN '⚖️ Final Verdict: Lawyer Up. ' || v_pct || '% said it''s that serious.'
      WHEN 'therapy' THEN '🛋 Final Verdict: Therapy Might Help.'
      WHEN 'update' THEN '👀 Final Verdict: Need Update — we are INVESTED.'
      ELSE 'The jury was split. No clear verdict — but the debate was real 🍿'
    END;

    v_badge := CASE v_kind
      WHEN 'red_flag' THEN 'final_verdict_red_flag'
      WHEN 'green_flag' THEN 'final_verdict_green_flag'
      WHEN 'run' THEN 'final_verdict_run'
      WHEN 'talk' THEN 'final_verdict_talk'
      ELSE 'public_debate'
    END;

    UPDATE public.court_cases
       SET status = 'decided',
           decided_at = now(),
           final_verdict = v_kind,
           ai_summary = v_summary
     WHERE id = r.id;

    -- Verdict notification
    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (
      v_author,
      'court_verdict',
      jsonb_build_object(
        'case_id', r.id,
        'post_id', r.post_id,
        'verdict', v_kind,
        'percent', v_pct,
        'message', '👑 Final verdict is in for your story in ' || r.region_label || ' Court.'
      )
    );

    -- Verdict badge
    INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
    VALUES (r.post_id, v_author, r.id, v_badge, r.region_label);

    -- Mark legendary if world-scope and high engagement
    IF r.scope = 'world' AND v_total >= 50 THEN
      UPDATE public.court_cases SET status = 'legendary' WHERE id = r.id;
      INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
      VALUES (r.post_id, v_author, r.id, 'viral_case', r.region_label);
    END IF;

    finalized := finalized + 1;
  END LOOP;
  RETURN finalized;
END $$;

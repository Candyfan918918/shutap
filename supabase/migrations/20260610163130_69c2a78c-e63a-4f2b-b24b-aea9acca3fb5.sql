
-- ============================================================
-- COURT MECHANICS — spec-aligned nomination & escalation
-- ============================================================

-- ---- 1. compute_post_nomination_score ----------------------
CREATE OR REPLACE FUNCTION public.compute_post_nomination_score(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wvs numeric := 0;
  v_total int := 0;
  v_dom int := 0;
  v_contro numeric := 0;
  v_hours numeric := 1;
  v_relates int := 0;
  v_participants int := 0;
  v_comments int := 0;
  v_score numeric := 0;
  v_published_at timestamptz;
BEGIN
  SELECT COALESCE(published_at, created_at) INTO v_published_at
  FROM public.posts WHERE id = _post_id;
  IF v_published_at IS NULL THEN RETURN; END IF;

  v_hours := GREATEST(EXTRACT(EPOCH FROM (now() - v_published_at)) / 3600.0, 1.0);

  SELECT COALESCE(SUM(weight), 0), COUNT(*)
    INTO v_wvs, v_total
  FROM public.post_verdict_votes
  WHERE post_id = _post_id AND quarantined = false;

  IF v_total > 0 THEN
    SELECT MAX(c) INTO v_dom FROM (
      SELECT COUNT(*) AS c FROM public.post_verdict_votes
      WHERE post_id = _post_id AND quarantined = false GROUP BY kind
    ) t;
    v_contro := 1 - ABS((v_dom::numeric / v_total::numeric) - 0.5) * 2;
  END IF;

  SELECT COALESCE(SUM( (SELECT COUNT(*) FROM public.post_perspective_relates ppr WHERE ppr.perspective_id = pp.id) ), 0)
    INTO v_relates
  FROM public.post_perspectives pp WHERE pp.post_id = _post_id;

  SELECT COUNT(*) INTO v_participants
  FROM public.post_perspectives
  WHERE post_id = _post_id AND standing_status = 'verified';

  SELECT COUNT(*) INTO v_comments
  FROM public.post_comments
  WHERE post_id = _post_id AND deleted_at IS NULL AND status = 'published';

  v_score := (v_wvs / v_hours)
           + v_contro
           + (v_relates * 0.3)
           + (v_participants * 2.0)
           + (v_comments * 0.1);

  UPDATE public.posts
     SET nomination_score = v_score,
         weighted_vote_sum = v_wvs,
         controversy_score = (v_contro * 100)::int,
         relate_count = v_relates,
         perspective_count = v_participants
   WHERE id = _post_id;
END $$;

-- ---- 2. tier resolver from voter geography -----------------
CREATE OR REPLACE FUNCTION public._resolve_entry_tier(_post_id uuid)
RETURNS TABLE(tier text, region_code text, region_label text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_city text;
  v_top_city_count int;
  v_total int;
  v_country text;
  v_distinct_cities int;
  v_distinct_countries int;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.post_verdict_votes v JOIN public.profiles p ON p.id = v.user_id
  WHERE v.post_id = _post_id;

  SELECT COUNT(DISTINCT p.country_code), COUNT(DISTINCT p.city)
    INTO v_distinct_countries, v_distinct_cities
  FROM public.post_verdict_votes v JOIN public.profiles p ON p.id = v.user_id
  WHERE v.post_id = _post_id;

  IF v_distinct_countries >= 2 THEN
    SELECT p.country_code, COUNT(*) INTO v_country, v_top_city_count
    FROM public.post_verdict_votes v JOIN public.profiles p ON p.id = v.user_id
    WHERE v.post_id = _post_id GROUP BY p.country_code ORDER BY COUNT(*) DESC LIMIT 1;
    RETURN QUERY SELECT 'national'::text, COALESCE(v_country,'XX'), 'National Court'::text;
    RETURN;
  END IF;

  IF v_distinct_cities >= 3 THEN
    SELECT p.country_code INTO v_country
    FROM public.post_verdict_votes v JOIN public.profiles p ON p.id = v.user_id
    WHERE v.post_id = _post_id GROUP BY p.country_code ORDER BY COUNT(*) DESC LIMIT 1;
    RETURN QUERY SELECT 'regional'::text, COALESCE(v_country,'XX'), 'Regional Court'::text;
    RETURN;
  END IF;

  SELECT p.city, COUNT(*) INTO v_top_city, v_top_city_count
  FROM public.post_verdict_votes v JOIN public.profiles p ON p.id = v.user_id
  WHERE v.post_id = _post_id AND p.city IS NOT NULL
  GROUP BY p.city ORDER BY COUNT(*) DESC LIMIT 1;

  IF v_top_city IS NULL THEN v_top_city := 'unknown'; END IF;
  RETURN QUERY SELECT 'city'::text, lower(replace(v_top_city,' ','_')), (v_top_city || ' City Court')::text;
END $$;

-- ---- 3. tier duration helper -------------------------------
CREATE OR REPLACE FUNCTION public._tier_duration(_tier text)
RETURNS interval
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _tier
    WHEN 'city' THEN interval '12 hours'
    WHEN 'regional' THEN interval '24 hours'
    WHEN 'national' THEN interval '48 hours'
    WHEN 'world' THEN interval '72 hours'
    ELSE interval '24 hours' END
$$;

-- ---- 4. event-driven nomination ----------------------------
CREATE OR REPLACE FUNCTION public.maybe_nominate_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts;
  v_threshold numeric;
  v_score numeric;
  v_tier text;
  v_region_code text;
  v_region_label text;
  v_scope text;
  v_category text;
  v_dur interval;
BEGIN
  SELECT * INTO v_post FROM public.posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_post.status <> 'published' THEN RETURN false; END IF;
  IF v_post.visibility <> 'public' THEN RETURN false; END IF;
  IF v_post.deleted_at IS NOT NULL THEN RETURN false; END IF;
  IF v_post.candidacy_paused THEN RETURN false; END IF;
  IF v_post.cool_down_until IS NOT NULL AND v_post.cool_down_until > now() THEN RETURN false; END IF;

  PERFORM public.compute_post_nomination_score(_post_id);
  SELECT nomination_score INTO v_score FROM public.posts WHERE id = _post_id;

  IF EXISTS (SELECT 1 FROM public.court_cases WHERE post_id = _post_id) THEN
    RETURN false;
  END IF;

  -- 95th percentile of live, eligible posts
  SELECT COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY nomination_score), 0)
    INTO v_threshold
  FROM public.posts
  WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
    AND candidacy_paused = false
    AND (cool_down_until IS NULL OR cool_down_until <= now())
    AND nomination_score IS NOT NULL;

  -- Minimum signal floor so the very first posts don't auto-nominate
  IF v_score < GREATEST(v_threshold, 1.0) THEN RETURN false; END IF;

  SELECT t.tier, t.region_code, t.region_label
    INTO v_tier, v_region_code, v_region_label
  FROM public._resolve_entry_tier(_post_id) t;

  v_scope := CASE v_tier WHEN 'city' THEN 'city' WHEN 'world' THEN 'world' ELSE 'country' END;
  v_dur := public._tier_duration(v_tier);
  v_category := COALESCE(v_post.score_category, 'general');

  INSERT INTO public.court_cases
    (post_id, scope, region_code, region_label, status,
     current_tier, current_category_court,
     nominated_at, opens_at, closes_at, verdict_lock_at,
     engagement_score, controversy_score)
  VALUES
    (_post_id, v_scope, v_region_code, v_region_label, 'in_court',
     v_tier, v_category,
     now(), now(), now() + v_dur, now() + v_dur,
     GREATEST(v_score::int, 1), v_post.controversy_score)
  ON CONFLICT (post_id, scope, region_code) DO NOTHING;

  INSERT INTO public.court_tiers (case_id, tier, started_at, vote_count)
  SELECT id, v_tier, now(),
         (SELECT COUNT(*) FROM public.post_verdict_votes WHERE post_id = _post_id)
  FROM public.court_cases WHERE post_id = _post_id;

  INSERT INTO public.notifications (user_id, kind, payload)
  VALUES (v_post.author_id, 'court_entered',
    jsonb_build_object(
      'post_id', _post_id,
      'tier', v_tier,
      'region_label', v_region_label,
      'message', 'Your case has been called to ' || v_region_label || '. The hearing begins now.'
    ));

  RETURN true;
END $$;

-- ---- 5. finalize / escalate at deadline --------------------
CREATE OR REPLACE FUNCTION public.finalize_court_cases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed int := 0;
  r record;
  v_next_tier text;
  v_distinct_cities int;
  v_distinct_countries int;
  v_kind text;
  v_count int;
  v_total int;
  v_pct int;
  v_summary text;
BEGIN
  FOR r IN
    SELECT cc.*, p.author_id
    FROM public.court_cases cc
    JOIN public.posts p ON p.id = cc.post_id
    WHERE cc.status = 'in_court'
      AND COALESCE(cc.verdict_lock_at, cc.closes_at) <= now()
  LOOP
    -- recheck distribution for escalation
    SELECT COUNT(DISTINCT pr.city), COUNT(DISTINCT pr.country_code)
      INTO v_distinct_cities, v_distinct_countries
    FROM public.post_verdict_votes v JOIN public.profiles pr ON pr.id = v.user_id
    WHERE v.post_id = r.post_id;

    v_next_tier := NULL;
    IF r.current_tier = 'city' AND v_distinct_cities >= 3 THEN v_next_tier := 'regional';
    ELSIF r.current_tier = 'regional' AND v_distinct_countries >= 2 THEN v_next_tier := 'national';
    ELSIF r.current_tier = 'national' AND v_distinct_countries >= 4 THEN v_next_tier := 'world';
    END IF;

    IF v_next_tier IS NOT NULL THEN
      UPDATE public.court_cases
         SET current_tier = v_next_tier,
             verdict_lock_at = now() + public._tier_duration(v_next_tier),
             closes_at = now() + public._tier_duration(v_next_tier),
             scope = CASE v_next_tier WHEN 'world' THEN 'world' WHEN 'city' THEN 'city' ELSE 'country' END,
             region_label = initcap(v_next_tier) || ' Court'
       WHERE id = r.id;
      INSERT INTO public.court_tiers (case_id, tier, started_at, vote_count)
      VALUES (r.id, v_next_tier, now(),
              (SELECT COUNT(*) FROM public.post_verdict_votes WHERE post_id = r.post_id));
      INSERT INTO public.notifications (user_id, kind, payload)
      VALUES (r.author_id, 'court_escalated',
        jsonb_build_object('case_id', r.id, 'post_id', r.post_id, 'tier', v_next_tier,
          'message', 'The room kept growing. Your case escalated to ' || initcap(v_next_tier) || ' Court.'));
      CONTINUE;
    END IF;

    -- No escalation → finalize
    SELECT kind, cnt INTO v_kind, v_count FROM (
      SELECT kind, COUNT(*) AS cnt FROM public.post_verdict_votes
      WHERE post_id = r.post_id AND quarantined = false
      GROUP BY kind ORDER BY cnt DESC LIMIT 1
    ) t;
    SELECT COUNT(*) INTO v_total FROM public.post_verdict_votes
      WHERE post_id = r.post_id AND quarantined = false;
    IF v_total IS NULL OR v_total = 0 THEN v_kind := 'no_verdict'; v_pct := 0;
    ELSE v_pct := round((v_count::numeric / v_total::numeric) * 100); END IF;

    v_summary := CASE v_kind
      WHEN 'red_flag' THEN 'The bench rules: red flag. ' || v_pct || '% of the room agreed.'
      WHEN 'green_flag' THEN 'The bench rules: green flag. ' || v_pct || '% kept them.'
      WHEN 'run' THEN 'The bench rules: run. ' || v_pct || '% said so.'
      WHEN 'talk_it_out' THEN 'The bench rules: talk it out. ' || v_pct || '% saw a conversation, not a case.'
      WHEN 'lawyer_up' THEN 'The bench rules: lawyer up. ' || v_pct || '% said it is that serious.'
      WHEN 'therapy_might_help' THEN 'The bench rules: therapy might help.'
      WHEN 'need_update' THEN 'The bench reserves judgment. The room wants more.'
      ELSE 'The room was split. No verdict declared.'
    END;

    UPDATE public.court_cases
       SET status = 'decided',
           decided_at = now(),
           final_verdict = v_kind,
           ai_summary = v_summary,
           bench_verdict_line = v_summary
     WHERE id = r.id;

    UPDATE public.post_perspectives SET locked_at = now()
      WHERE post_id = r.post_id AND locked_at IS NULL;

    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (r.author_id, 'court_verdict',
      jsonb_build_object('case_id', r.id, 'post_id', r.post_id,
        'verdict', v_kind, 'percent', v_pct, 'message', v_summary));

    INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
    VALUES (r.post_id, r.author_id, r.id,
            CASE v_kind WHEN 'red_flag' THEN 'final_verdict_red_flag'
                        WHEN 'green_flag' THEN 'final_verdict_green_flag'
                        WHEN 'run' THEN 'final_verdict_run'
                        WHEN 'talk_it_out' THEN 'final_verdict_talk'
                        ELSE 'public_debate' END,
            r.region_label);

    IF r.current_tier = 'world' AND v_total >= 50 THEN
      UPDATE public.court_cases SET status = 'legendary' WHERE id = r.id;
      INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
      VALUES (r.post_id, r.author_id, r.id, 'viral_case', r.region_label);
    END IF;

    closed := closed + 1;
  END LOOP;
  RETURN closed;
END $$;

-- ---- 6. triggers: nominate on engagement events ------------
CREATE OR REPLACE FUNCTION public._trg_maybe_nominate_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.maybe_nominate_post(COALESCE(NEW.post_id, OLD.post_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_nominate_on_vote ON public.post_verdict_votes;
CREATE TRIGGER trg_nominate_on_vote
AFTER INSERT OR UPDATE OR DELETE ON public.post_verdict_votes
FOR EACH ROW EXECUTE FUNCTION public._trg_maybe_nominate_vote();

CREATE OR REPLACE FUNCTION public._trg_maybe_nominate_relate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post uuid;
BEGIN
  SELECT post_id INTO v_post FROM public.post_perspectives WHERE id = COALESCE(NEW.perspective_id, OLD.perspective_id);
  IF v_post IS NOT NULL THEN PERFORM public.maybe_nominate_post(v_post); END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_nominate_on_relate ON public.post_perspective_relates;
CREATE TRIGGER trg_nominate_on_relate
AFTER INSERT OR DELETE ON public.post_perspective_relates
FOR EACH ROW EXECUTE FUNCTION public._trg_maybe_nominate_relate();

CREATE OR REPLACE FUNCTION public._trg_maybe_nominate_persp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.standing_status = 'verified' AND (OLD.standing_status IS DISTINCT FROM 'verified') THEN
    PERFORM public.maybe_nominate_post(NEW.post_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_nominate_on_perspective ON public.post_perspectives;
CREATE TRIGGER trg_nominate_on_perspective
AFTER UPDATE ON public.post_perspectives
FOR EACH ROW EXECUTE FUNCTION public._trg_maybe_nominate_persp();

CREATE OR REPLACE FUNCTION public._trg_maybe_nominate_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.maybe_nominate_post(COALESCE(NEW.post_id, OLD.post_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_nominate_on_comment ON public.post_comments;
CREATE TRIGGER trg_nominate_on_comment
AFTER INSERT OR UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public._trg_maybe_nominate_comment();

-- ---- 7. keep cron-callable wrappers as safe no-ops ---------
CREATE OR REPLACE FUNCTION public.nominate_court_cases(_scope text, _region_code text, _region_label text, _limit integer DEFAULT 5)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  -- Safety-net sweep: recompute + re-evaluate any post with recent vote activity.
  FOR r IN
    SELECT DISTINCT post_id FROM public.post_verdict_votes
    WHERE created_at > now() - interval '1 hour'
    LIMIT 200
  LOOP
    IF public.maybe_nominate_post(r.post_id) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.promote_court_cases()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 0; -- event-driven nomination now sets status directly to 'in_court'
$$;

REVOKE EXECUTE ON FUNCTION public.compute_post_nomination_score(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.maybe_nominate_post(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._resolve_entry_tier(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._tier_duration(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.compute_post_nomination_score(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_nominate_post(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._resolve_entry_tier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._tier_duration(text) TO service_role;

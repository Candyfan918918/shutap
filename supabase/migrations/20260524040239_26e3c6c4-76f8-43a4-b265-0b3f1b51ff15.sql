
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
      WHEN 'talk_it_out' THEN '🗣 Final Verdict: Talk It Out. This one deserves one honest conversation.'
      WHEN 'lawyer_up' THEN '⚖️ Final Verdict: Lawyer Up. ' || v_pct || '% said it''s that serious.'
      WHEN 'therapy_might_help' THEN '🛋 Final Verdict: Therapy Might Help.'
      WHEN 'need_update' THEN '👀 Final Verdict: Need Update — we are INVESTED.'
      ELSE 'The jury was split. No clear verdict — but the debate was real 🍿'
    END;

    v_badge := CASE v_kind
      WHEN 'red_flag' THEN 'final_verdict_red_flag'
      WHEN 'green_flag' THEN 'final_verdict_green_flag'
      WHEN 'run' THEN 'final_verdict_run'
      WHEN 'talk_it_out' THEN 'final_verdict_talk'
      ELSE 'public_debate'
    END;

    UPDATE public.court_cases
       SET status = 'decided',
           decided_at = now(),
           final_verdict = v_kind,
           ai_summary = v_summary
     WHERE id = r.id;

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

    INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
    VALUES (r.post_id, v_author, r.id, v_badge, r.region_label);

    IF r.scope = 'world' AND v_total >= 50 THEN
      UPDATE public.court_cases SET status = 'legendary' WHERE id = r.id;
      INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
      VALUES (r.post_id, v_author, r.id, 'viral_case', r.region_label);
    END IF;

    finalized := finalized + 1;
  END LOOP;
  RETURN finalized;
END $$;

REVOKE EXECUTE ON FUNCTION public.finalize_court_cases() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.finalize_court_cases() TO service_role;


-- ============================================================================
-- Seed helper functions for the Shutap sample dataset
-- ============================================================================

-- 1. Users (auth.users + profiles) -------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_create_users(_users jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  r jsonb;
  n int := 0;
  v_handle text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(_users) LOOP
    -- Insert auth user (trigger handle_new_user creates a profile + 'user' role)
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      (r->>'id')::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      r->>'email', '',
      now(), '{"provider":"seed","providers":["seed"]}'::jsonb,
      jsonb_build_object('locale','en'),
      false, false, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Build a handle from the username (slug + uniquify)
    v_handle := substring(public._slugify_handle(coalesce(r->>'username','user')) FROM 1 FOR 18);
    IF v_handle IS NULL OR char_length(v_handle) < 3 THEN
      v_handle := 'u_' || substring((r->>'id'),1,10);
    END IF;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles WHERE handle = v_handle AND id <> (r->>'id')::uuid
    ) LOOP
      v_handle := substring(v_handle FROM 1 FOR 18) || (floor(random()*9999)::int)::text;
    END LOOP;

    UPDATE public.profiles
       SET nickname         = coalesce(r->>'username', nickname),
           display_name     = coalesce(r->>'username', display_name),
           handle           = v_handle,
           country_code     = r->>'country_code',
           city             = r->>'city',
           city_label       = r->>'city',
           nationality      = r->>'alias_nationality',
           emotion          = r->>'alias_emotion',
           creature         = r->>'alias_animal',
           age_verified     = coalesce((r->>'age_verified')::boolean, false),
           justice_score    = coalesce((r->>'justice_score')::int, 0),
           wisdom_score     = coalesce((r->>'wisdom_score')::int, 0),
           empathy_score    = coalesce((r->>'empathy_score')::int, 0),
           juror_tier       = r->>'juror_tier',
           onboarded_at     = coalesce((r->>'onboarded_at')::timestamptz, now()),
           anonymous_mode   = false
     WHERE id = (r->>'id')::uuid;

    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 2. Posts -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_insert_posts(_posts jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb;
  n int := 0;
  v_status post_status;
  v_tone post_tone;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(_posts) LOOP
    v_status := CASE WHEN (r->>'stage') IN ('draft','rejected') THEN 'draft'::post_status
                     ELSE 'published'::post_status END;
    v_tone := COALESCE(NULLIF(r->>'tone','')::post_tone, 'funny'::post_tone);
    INSERT INTO public.posts (
      id, author_id, status, title, story_text, tone,
      score_category, badges, hashtags, locale, visibility,
      published_at, is_seed,
      view_count, like_count, comment_count,
      drama_score, controversy_score, relate_count, pii_removed
    ) VALUES (
      (r->>'id')::uuid,
      (r->>'author_id')::uuid,
      v_status,
      left(r->>'title', 200),
      r->>'body',
      v_tone,
      r->>'category',
      ARRAY[]::text[],
      ARRAY[]::text[],
      'en', 'public',
      CASE WHEN v_status='published'::post_status
           THEN coalesce((r->>'published_at')::timestamptz, now() - interval '30 days')
           ELSE NULL END,
      true,
      coalesce((r->>'views')::int, 0),
      coalesce((r->>'reactions')::int, 0),
      0, -- comment_count maintained by trigger
      coalesce((r->>'drama_score')::int, 0),
      coalesce((r->>'controversy_score')::int, 0),
      0,
      true
    )
    ON CONFLICT (id) DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 3. Court cases + tiers + badges -------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_insert_court(
  _cases jsonb, _tiers jsonb, _badges jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb;
  n int := 0;
  v_scope text;
  v_region text;
BEGIN
  -- cases
  FOR r IN SELECT * FROM jsonb_array_elements(_cases) LOOP
    v_scope := CASE r->>'current_tier'
                  WHEN 'city' THEN 'city'
                  WHEN 'world' THEN 'world'
                  ELSE 'country' END;
    v_region := CASE r->>'current_tier'
                  WHEN 'city' THEN 'city_' || substring((r->>'id'),4,4)
                  WHEN 'world' THEN 'WORLD'
                  ELSE COALESCE(r->>'region_code','XX') END;
    INSERT INTO public.court_cases (
      id, post_id, scope, region_code, region_label,
      status, current_tier, nominated_at, opens_at, closes_at,
      verdict_lock_at, decided_at, final_verdict, bench_verdict_line,
      ai_summary, engagement_score, controversy_score
    ) VALUES (
      (r->>'id')::uuid,
      (r->>'post_id')::uuid,
      v_scope,
      v_region,
      initcap(coalesce(r->>'current_tier','City')) || ' Court',
      r->>'status',
      r->>'current_tier',
      coalesce((r->>'nominated_at')::timestamptz, now() - interval '7 days'),
      coalesce((r->>'opens_at')::timestamptz, now() - interval '7 days'),
      coalesce((r->>'closes_at')::timestamptz, (r->>'verdict_lock_at')::timestamptz),
      (r->>'verdict_lock_at')::timestamptz,
      CASE WHEN r->>'status' IN ('decided','legendary')
           THEN coalesce((r->>'decided_at')::timestamptz, (r->>'verdict_lock_at')::timestamptz)
           ELSE NULL END,
      r->>'final_verdict',
      r->>'bench_verdict_line',
      r->>'ai_summary',
      coalesce((r->>'votes_total')::int, 0),
      coalesce((r->>'controversy_score')::int, 0)
    )
    ON CONFLICT (post_id, scope, region_code) DO NOTHING;
    n := n + 1;
  END LOOP;

  -- tiers
  FOR r IN SELECT * FROM jsonb_array_elements(_tiers) LOOP
    INSERT INTO public.court_tiers (case_id, tier, started_at, ended_at, vote_count)
    VALUES (
      (r->>'case_id')::uuid,
      r->>'tier',
      coalesce((r->>'entered_at')::timestamptz, now() - interval '7 days'),
      (r->>'ended_at')::timestamptz,
      coalesce((r->>'vote_count')::int, 0)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- final-verdict badges
  FOR r IN SELECT * FROM jsonb_array_elements(_badges) LOOP
    INSERT INTO public.court_case_badges (post_id, author_id, case_id, badge_kind, region_label)
    SELECT cc.post_id, p.author_id, cc.id,
           'final_verdict_' || (r->>'badge'),
           cc.region_label
      FROM public.court_cases cc
      JOIN public.posts p ON p.id = cc.post_id
     WHERE cc.id = (r->>'case_id')::uuid
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN n;
END $$;

-- 4. Votes -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_insert_votes(_votes jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb; n int := 0;
BEGIN
  -- Temporarily disable nomination trigger so we don't auto-create new cases
  ALTER TABLE public.post_verdict_votes DISABLE TRIGGER trg_nominate_on_vote;
  FOR r IN SELECT * FROM jsonb_array_elements(_votes) LOOP
    INSERT INTO public.post_verdict_votes (post_id, user_id, kind, created_at, weight)
    SELECT cc.post_id, (r->>'user_id')::uuid, r->>'kind',
           coalesce((r->>'created_at')::timestamptz, now()),
           coalesce((r->>'weight')::numeric, 1.0)
      FROM public.court_cases cc
     WHERE cc.id = (r->>'case_id')::uuid
    ON CONFLICT (post_id, user_id) DO NOTHING;
    n := n + 1;
  END LOOP;
  ALTER TABLE public.post_verdict_votes ENABLE TRIGGER trg_nominate_on_vote;
  RETURN n;
END $$;

-- 5. Comments ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_insert_comments(_comments jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb; n int := 0;
BEGIN
  ALTER TABLE public.post_comments DISABLE TRIGGER trg_nominate_on_comment;
  FOR r IN SELECT * FROM jsonb_array_elements(_comments) LOOP
    INSERT INTO public.post_comments (
      post_id, user_id, body, created_at, is_counsel_pick, is_same_situation
    ) VALUES (
      (r->>'post_id')::uuid,
      (r->>'user_id')::uuid,
      left(r->>'body', 1000),
      coalesce((r->>'created_at')::timestamptz, now()),
      coalesce((r->>'is_counsel_pick')::boolean, false),
      coalesce((r->>'is_same_situation')::boolean, false)
    );
    n := n + 1;
  END LOOP;
  ALTER TABLE public.post_comments ENABLE TRIGGER trg_nominate_on_comment;
  RETURN n;
END $$;

-- 6. HOF ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_insert_hof(_scores jsonb, _badges jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb; n int := 0;
  v_period text; v_entity text; v_eid uuid;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(_scores) LOOP
    v_period := CASE WHEN r->>'period' = 'all_time' THEN 'all' ELSE r->>'period' END;
    IF r ? 'user_id' THEN v_entity := 'user'; v_eid := (r->>'user_id')::uuid;
    ELSE v_entity := 'story'; v_eid := (r->>'post_id')::uuid;
    END IF;
    INSERT INTO public.hof_scores (entity_type, entity_id, period, category, score)
    VALUES (v_entity, v_eid, v_period, r->>'category', (r->>'score')::numeric)
    ON CONFLICT (entity_type, entity_id, period, category)
      DO UPDATE SET score = EXCLUDED.score, updated_at = now();
    n := n + 1;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(_badges) LOOP
    INSERT INTO public.hof_badges (entity_type, entity_id, category, period, period_key, rank)
    VALUES ('story', (r->>'post_id')::uuid, r->>'category',
            'monthly', r->>'period_key', (r->>'rank')::int)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN n;
END $$;

-- 7. Recompute denormalised counters after the load -------------------------
CREATE OR REPLACE FUNCTION public._seed_reconcile()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- comment + verdict counters (in case triggers were off for some rows)
  UPDATE public.posts p
     SET comment_count = (SELECT COUNT(*) FROM public.post_comments c
                          WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.status='published');
  -- nomination scores so the bench knows what to surface
  PERFORM public.compute_post_nomination_score(p.id)
    FROM public.posts p WHERE p.is_seed = true;
END $$;

-- 8. Teardown ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_teardown()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  -- posts cascade-delete comments/votes/cases via FKs
  DELETE FROM public.posts WHERE is_seed = true;
  DELETE FROM public.hof_scores WHERE entity_type IN ('story','case','user')
    AND entity_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed+%@shutap-seed.local');
  DELETE FROM auth.users WHERE email LIKE 'seed+%@shutap-seed.local';
END $$;

-- Lock these admin helpers down: only the postgres owner can EXECUTE.
REVOKE ALL ON FUNCTION
  public._seed_create_users(jsonb),
  public._seed_insert_posts(jsonb),
  public._seed_insert_court(jsonb,jsonb,jsonb),
  public._seed_insert_votes(jsonb),
  public._seed_insert_comments(jsonb),
  public._seed_insert_hof(jsonb,jsonb),
  public._seed_reconcile(),
  public._seed_teardown()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public._seed_create_users(jsonb),
  public._seed_insert_posts(jsonb),
  public._seed_insert_court(jsonb,jsonb,jsonb),
  public._seed_insert_votes(jsonb),
  public._seed_insert_comments(jsonb),
  public._seed_insert_hof(jsonb,jsonb),
  public._seed_reconcile(),
  public._seed_teardown()
  TO sandbox_exec, service_role;

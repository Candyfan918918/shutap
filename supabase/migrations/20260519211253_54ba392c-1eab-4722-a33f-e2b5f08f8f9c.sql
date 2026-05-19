
-- ============================================================================
-- Profile + Settings + Post Management — schema additions
-- ============================================================================

-- ---------- 1. Extend profiles -------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS anonymous_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_kind text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS notif_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS privacy jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format
    CHECK (handle IS NULL OR handle ~ '^[a-z0-9_]{3,24}$') NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_handle_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 280) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_bio_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_kind_valid
    CHECK (avatar_kind IN ('default', 'upload', 'ai')) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_avatar_kind_valid;

-- Backfill handles for existing rows from nickname
CREATE OR REPLACE FUNCTION public._slugify_handle(_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(coalesce(_text, ''), '[^a-zA-Z0-9_]+', '_', 'g'),
      '^_+|_+$', '', 'g'
    )
  )
$$;

DO $$
DECLARE
  rec record;
  base text;
  candidate text;
  i int;
BEGIN
  FOR rec IN SELECT id, nickname FROM public.profiles WHERE handle IS NULL LOOP
    base := substring(public._slugify_handle(rec.nickname) FROM 1 FOR 16);
    IF base IS NULL OR char_length(base) < 3 THEN
      base := 'user_' || substring(rec.id::text FROM 1 FOR 6);
    END IF;
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate) LOOP
      i := i + 1;
      candidate := substring(base FROM 1 FOR 18) || (floor(random()*99999)::int)::text;
      EXIT WHEN i > 25;
    END LOOP;
    IF i > 25 THEN
      candidate := 'u_' || substring(rec.id::text FROM 1 FOR 10);
    END IF;
    UPDATE public.profiles SET handle = candidate WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique ON public.profiles (handle);

-- Patch handle_new_user trigger to also seed handle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_locale text;
  v_nick text;
  v_base text;
  v_handle text;
  v_i int := 0;
BEGIN
  v_locale := COALESCE(NEW.raw_user_meta_data->>'locale', 'en');

  SELECT text INTO v_nick FROM public.nicknames WHERE locale = v_locale ORDER BY random() LIMIT 1;
  IF v_nick IS NULL THEN
    SELECT text INTO v_nick FROM public.nicknames WHERE locale = 'en' ORDER BY random() LIMIT 1;
  END IF;
  IF v_nick IS NULL THEN
    v_nick := 'Anonymous_' || substr(NEW.id::text, 1, 6);
  END IF;

  v_base := substring(public._slugify_handle(v_nick) FROM 1 FOR 16);
  IF v_base IS NULL OR char_length(v_base) < 3 THEN
    v_base := 'user_' || substring(NEW.id::text FROM 1 FOR 6);
  END IF;
  v_handle := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_handle) LOOP
    v_i := v_i + 1;
    v_handle := substring(v_base FROM 1 FOR 18) || (floor(random()*99999)::int)::text;
    EXIT WHEN v_i > 25;
  END LOOP;
  IF v_i > 25 THEN
    v_handle := 'u_' || substring(NEW.id::text FROM 1 FOR 10);
  END IF;

  INSERT INTO public.profiles (id, nickname, locale, email, handle)
  VALUES (NEW.id, v_nick, v_locale, NEW.email, v_handle)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 2. Extend posts ---------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forward_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_visibility_valid
    CHECK (visibility IN ('public','private','friends')) NOT VALID;
ALTER TABLE public.posts VALIDATE CONSTRAINT posts_visibility_valid;

CREATE INDEX IF NOT EXISTS posts_author_status_idx ON public.posts (author_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS posts_published_feed_idx
  ON public.posts (published_at DESC)
  WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL;

-- ---------- 3. follows --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON public.follows (followee_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows readable" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows owner insert" ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows owner delete" ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ---------- 4. friendships ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id),
  CHECK (status IN ('pending','accepted','declined'))
);
CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx
  ON public.friendships (addressee_id, status);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships visible to parties" ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships requester insert" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships addressee update" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id);
CREATE POLICY "friendships parties delete" ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- is_friend helper
CREATE OR REPLACE FUNCTION public.is_friend(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  )
$$;

-- ---------- 5. saved_posts ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS saved_posts_post_idx ON public.saved_posts (post_id);
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_posts owner select" ON public.saved_posts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "saved_posts owner insert" ON public.saved_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_posts owner delete" ON public.saved_posts FOR DELETE
  USING (auth.uid() = user_id);

-- ---------- 6. blocks ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks owner all" ON public.blocks FOR ALL
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ---------- 7. post_views -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  viewer_id uuid,
  session_hash text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  country text
);
CREATE INDEX IF NOT EXISTS post_views_post_day_idx
  ON public.post_views (post_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS post_views_dedupe_idx
  ON public.post_views (post_id, session_hash, viewed_at DESC);
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
-- Only author can read aggregate via server fn (admin client); no direct read for users
CREATE POLICY "post_views author read" ON public.post_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_views.post_id AND p.author_id = auth.uid()));

-- ---------- 8. post_forwards --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_forwards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  sender_id uuid,
  channel text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_forwards_post_idx ON public.post_forwards (post_id, created_at DESC);
ALTER TABLE public.post_forwards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_forwards author read" ON public.post_forwards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_forwards.post_id AND p.author_id = auth.uid()));

-- ---------- 9. Update posts SELECT policy to respect visibility + soft delete -
DROP POLICY IF EXISTS "posts published readable" ON public.posts;
CREATE POLICY "posts visibility readable" ON public.posts FOR SELECT USING (
  deleted_at IS NULL AND (
    auth.uid() = author_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (status = 'published' AND visibility = 'public')
    OR (status = 'published' AND visibility = 'friends' AND public.is_friend(auth.uid(), author_id))
  )
);

-- ---------- 10. Counter triggers ---------------------------------------------
CREATE OR REPLACE FUNCTION public._bump_post_counter(_post_id uuid, _col text, _delta int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.posts SET %I = GREATEST(0, %I + $1) WHERE id = $2', _col, _col)
    USING _delta, _post_id;
END $$;

CREATE OR REPLACE FUNCTION public._on_post_reaction_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public._bump_post_counter(NEW.post_id, 'like_count', 1);
  ELSIF TG_OP = 'DELETE' THEN PERFORM public._bump_post_counter(OLD.post_id, 'like_count', -1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS post_reactions_count_trg ON public.post_reactions;
CREATE TRIGGER post_reactions_count_trg
  AFTER INSERT OR DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public._on_post_reaction_change();

CREATE OR REPLACE FUNCTION public._on_post_share_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public._bump_post_counter(NEW.post_id, 'share_count', 1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS post_shares_count_trg ON public.post_shares;
CREATE TRIGGER post_shares_count_trg
  AFTER INSERT ON public.post_shares
  FOR EACH ROW EXECUTE FUNCTION public._on_post_share_change();

CREATE OR REPLACE FUNCTION public._on_saved_post_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public._bump_post_counter(NEW.post_id, 'save_count', 1);
  ELSIF TG_OP = 'DELETE' THEN PERFORM public._bump_post_counter(OLD.post_id, 'save_count', -1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS saved_posts_count_trg ON public.saved_posts;
CREATE TRIGGER saved_posts_count_trg
  AFTER INSERT OR DELETE ON public.saved_posts
  FOR EACH ROW EXECUTE FUNCTION public._on_saved_post_change();

CREATE OR REPLACE FUNCTION public._on_post_forward_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public._bump_post_counter(NEW.post_id, 'forward_count', 1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS post_forwards_count_trg ON public.post_forwards;
CREATE TRIGGER post_forwards_count_trg
  AFTER INSERT ON public.post_forwards
  FOR EACH ROW EXECUTE FUNCTION public._on_post_forward_change();

-- Backfill counters from existing data
UPDATE public.posts p SET
  like_count  = COALESCE((SELECT count(*) FROM public.post_reactions r WHERE r.post_id = p.id), 0),
  share_count = COALESCE((SELECT count(*) FROM public.post_shares    s WHERE s.post_id = p.id), 0),
  save_count  = COALESCE((SELECT count(*) FROM public.saved_posts    sp WHERE sp.post_id = p.id), 0);

-- ---------- 11. View dedupe + increment --------------------------------------
CREATE OR REPLACE FUNCTION public.increment_post_view(_post_id uuid, _session_hash text, _viewer_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recent boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.post_views
    WHERE post_id = _post_id
      AND session_hash = _session_hash
      AND viewed_at > now() - interval '24 hours'
  ) INTO v_recent;
  IF v_recent THEN RETURN false; END IF;
  INSERT INTO public.post_views (post_id, viewer_id, session_hash)
  VALUES (_post_id, _viewer_id, _session_hash);
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = _post_id;
  RETURN true;
END $$;

-- ---------- 12. Handle helpers -----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_handle_available(_handle text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _handle ~ '^[a-z0-9_]{3,24}$'
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE handle = _handle)
$$;

CREATE OR REPLACE FUNCTION public.suggest_handles(_base text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text := substring(public._slugify_handle(_base) FROM 1 FOR 18);
  out text[] := '{}';
  cand text;
  i int := 0;
BEGIN
  IF base IS NULL OR char_length(base) < 3 THEN
    base := 'user';
  END IF;
  WHILE array_length(out, 1) IS NULL OR array_length(out, 1) < 4 LOOP
    i := i + 1;
    cand := base || (floor(random()*999)::int)::text;
    IF public.is_handle_available(cand) THEN
      out := array_append(out, cand);
    END IF;
    EXIT WHEN i > 50;
  END LOOP;
  RETURN out;
END $$;

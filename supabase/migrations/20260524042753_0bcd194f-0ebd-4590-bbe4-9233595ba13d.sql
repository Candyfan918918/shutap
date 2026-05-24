-- ============ post_update_requests ============
CREATE TABLE public.post_update_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX idx_pur_post ON public.post_update_requests(post_id);
CREATE INDEX idx_pur_user ON public.post_update_requests(user_id);

ALTER TABLE public.post_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pur owner insert" ON public.post_update_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pur owner delete" ON public.post_update_requests
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "pur visible to owner and post author" ON public.post_update_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ post_updates ============
CREATE TABLE public.post_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'part',
  -- 'part' | 'time_jump' | 'broke_up' | 'got_married' | 'got_worse' | 'got_better' | 'final'
  title text,
  body text NOT NULL,
  media_url text,
  episode_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pu_post ON public.post_updates(post_id, episode_number);
CREATE INDEX idx_pu_author ON public.post_updates(author_id);

ALTER TABLE public.post_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_updates readable" ON public.post_updates
  FOR SELECT USING (
    deleted_at IS NULL
    AND status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id
        AND p.deleted_at IS NULL
        AND p.status = 'published'
        AND (
          p.visibility = 'public'
          OR auth.uid() = p.author_id
          OR (p.visibility = 'friends' AND is_friend(auth.uid(), p.author_id))
        )
    )
  );
CREATE POLICY "post_updates author insert" ON public.post_updates
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );
CREATE POLICY "post_updates author update" ON public.post_updates
  FOR UPDATE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "post_updates author delete" ON public.post_updates
  FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_post_updates_updated_at
  BEFORE UPDATE ON public.post_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ post_arc_follows ============
CREATE TABLE public.post_arc_follows (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_paf_post ON public.post_arc_follows(post_id);

ALTER TABLE public.post_arc_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paf owner insert" ON public.post_arc_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paf owner delete" ON public.post_arc_follows
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "paf visible to owner and post author" ON public.post_arc_follows
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

-- ============ posts counters ============
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS update_request_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS update_count integer NOT NULL DEFAULT 0;

-- bump update_request_count
CREATE OR REPLACE FUNCTION public._on_pur_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._bump_post_counter(NEW.post_id, 'update_request_count', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._bump_post_counter(OLD.post_id, 'update_request_count', -1);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_pur_change
AFTER INSERT OR DELETE ON public.post_update_requests
FOR EACH ROW EXECUTE FUNCTION public._on_pur_change();

-- bump update_count + auto-assign episode_number + notify followers/requesters
CREATE OR REPLACE FUNCTION public._on_post_update_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next int;
  v_post_title text;
BEGIN
  -- auto episode number
  SELECT COALESCE(MAX(episode_number), 0) + 1 INTO v_next
  FROM public.post_updates WHERE post_id = NEW.post_id AND id <> NEW.id;
  IF NEW.episode_number IS NULL OR NEW.episode_number < v_next THEN
    UPDATE public.post_updates SET episode_number = v_next WHERE id = NEW.id;
  END IF;

  PERFORM public._bump_post_counter(NEW.post_id, 'update_count', 1);

  SELECT title INTO v_post_title FROM public.posts WHERE id = NEW.post_id;

  -- notify arc followers
  INSERT INTO public.notifications (user_id, kind, payload)
  SELECT f.user_id, 'arc_update',
         jsonb_build_object(
           'post_id', NEW.post_id,
           'update_id', NEW.id,
           'episode', v_next,
           'kind', NEW.kind,
           'title', COALESCE(NEW.title, v_post_title),
           'message', 'Part ' || v_next || ' just dropped 👀'
         )
  FROM public.post_arc_follows f
  WHERE f.post_id = NEW.post_id AND f.user_id <> NEW.author_id;

  -- notify users who requested an update (dedupe vs followers)
  INSERT INTO public.notifications (user_id, kind, payload)
  SELECT r.user_id, 'arc_update_requested',
         jsonb_build_object(
           'post_id', NEW.post_id,
           'update_id', NEW.id,
           'episode', v_next,
           'kind', NEW.kind,
           'title', COALESCE(NEW.title, v_post_title),
           'message', 'You asked, they answered. Update ' || v_next || ' is live 🍿'
         )
  FROM public.post_update_requests r
  WHERE r.post_id = NEW.post_id
    AND r.user_id <> NEW.author_id
    AND NOT EXISTS (
      SELECT 1 FROM public.post_arc_follows f
      WHERE f.post_id = NEW.post_id AND f.user_id = r.user_id
    );

  RETURN NULL;
END $$;

CREATE TRIGGER trg_post_update_insert
AFTER INSERT ON public.post_updates
FOR EACH ROW EXECUTE FUNCTION public._on_post_update_insert();

CREATE OR REPLACE FUNCTION public._on_post_update_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._bump_post_counter(OLD.post_id, 'update_count', -1);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_post_update_delete
AFTER DELETE ON public.post_updates
FOR EACH ROW EXECUTE FUNCTION public._on_post_update_delete();
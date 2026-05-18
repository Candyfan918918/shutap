
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.story_status AS ENUM ('draft', 'pending', 'published', 'sensitive', 'removed');
CREATE TYPE public.interaction_kind AS ENUM ('view','like','save','share','been_through','worse','report','comment');
CREATE TYPE public.lead_status AS ENUM ('new','contacted','converted','closed');
CREATE TYPE public.trend_status AS ENUM ('ingested','approved','published','rejected');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  country TEXT,
  region TEXT,
  city TEXT,
  emotional_embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Nicknames pool (admin uploadable per-locale)
CREATE TABLE public.nicknames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL,
  text TEXT NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (locale, text)
);
ALTER TABLE public.nicknames ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nicknames_locale ON public.nicknames(locale, used_count);

-- Stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en',
  country TEXT,
  region TEXT,
  city TEXT,
  title TEXT,
  body_original TEXT NOT NULL,
  body_rewritten TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status public.story_status NOT NULL DEFAULT 'draft',
  score INT,
  score_category TEXT,
  subscores JSONB,
  ai_verdict TEXT,
  embedding vector(768),
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  share_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stories_published ON public.stories(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_stories_country_score ON public.stories(country, score DESC) WHERE status = 'published';
CREATE INDEX idx_stories_city_score ON public.stories(country, city, score DESC) WHERE status = 'published';
CREATE INDEX idx_stories_tags ON public.stories USING gin(tags);
CREATE INDEX idx_stories_embedding ON public.stories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AI run audit
CREATE TABLE public.story_ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input JSONB,
  output JSONB,
  cost_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_ai_runs ENABLE ROW LEVEL SECURITY;

-- Interactions
CREATE TABLE public.story_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  kind public.interaction_kind NOT NULL,
  dwell_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_interactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_interactions_user ON public.story_interactions(user_id, created_at DESC);
CREATE INDEX idx_interactions_story ON public.story_interactions(story_id, kind);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status public.story_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
  case_type TEXT,
  urgency INT,
  emotional_intensity INT,
  country TEXT,
  city TEXT,
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Trends
CREATE TABLE public.trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  topic TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  raw JSONB,
  ai_framing JSONB,
  status public.trend_status NOT NULL DEFAULT 'ingested',
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ===== RLS POLICIES =====

-- profiles: readable by all authenticated (public anonymous nicknames OK); writable by owner
CREATE POLICY "profiles readable to all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles: readable by owner & admins; only admins write
CREATE POLICY "roles select own or admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- nicknames: read by anyone; admin write
CREATE POLICY "nicknames public read" ON public.nicknames FOR SELECT USING (true);
CREATE POLICY "nicknames admin write" ON public.nicknames FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- stories: published readable by all; author full access; admins all
CREATE POLICY "stories published readable" ON public.stories FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stories author insert" ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "stories author update" ON public.stories FOR UPDATE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stories author delete" ON public.stories FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- ai runs: admin only
CREATE POLICY "ai_runs admin" ON public.story_ai_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- interactions: user writes own, reads own; story authors can read aggregates via server fn
CREATE POLICY "interactions self insert" ON public.story_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interactions self select" ON public.story_interactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- comments: public readable when published; owner write
CREATE POLICY "comments published readable" ON public.comments FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "comments owner insert" ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments owner update" ON public.comments FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- leads: admin only read; owner can insert their own
CREATE POLICY "leads owner insert" ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "leads admin read" ON public.leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "leads admin update" ON public.leads FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- trends: published readable; admin write
CREATE POLICY "trends published readable" ON public.trends FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "trends admin write" ON public.trends FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notifications: owner only
CREATE POLICY "notifications owner select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "notifications owner update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ===== Triggers =====

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-assign nickname on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_locale TEXT;
  v_nick TEXT;
BEGIN
  v_locale := COALESCE(NEW.raw_user_meta_data->>'locale', 'en');
  -- Pick a random nickname from the locale pool (fallback to 'en')
  SELECT text INTO v_nick
  FROM public.nicknames
  WHERE locale = v_locale
  ORDER BY random()
  LIMIT 1;
  IF v_nick IS NULL THEN
    SELECT text INTO v_nick FROM public.nicknames WHERE locale = 'en' ORDER BY random() LIMIT 1;
  END IF;
  IF v_nick IS NULL THEN
    v_nick := 'Anonymous_' || substr(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (id, nickname, locale)
  VALUES (NEW.id, v_nick, v_locale);

  -- Default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Storage buckets =====
INSERT INTO storage.buckets (id, name, public) VALUES ('story-media', 'story-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "story media public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'story-media');
CREATE POLICY "story media authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "story media owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- Enums
CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'removed');
CREATE TYPE public.post_tone AS ENUM ('funny', 'serious', 'chaotic', 'soft');
CREATE TYPE public.share_platform AS ENUM ('x', 'tiktok', 'instagram', 'xiaohongshu', 'facebook', 'imessage', 'whatsapp', 'copy_link');
CREATE TYPE public.reaction_kind AS ENUM ('been_there', 'worse', 'hug', 'laugh', 'drama');

-- posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  status public.post_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  story_text text NOT NULL,
  tone public.post_tone NOT NULL DEFAULT 'funny',
  badges text[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  media_url text,
  share_card_square text,
  share_card_vertical text,
  share_card_xhs text,
  platform_captions jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  score integer,
  score_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX idx_posts_status_pub ON public.posts(status, published_at DESC);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_story ON public.posts(story_id);
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts published readable" ON public.posts FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "posts author insert" ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts author update" ON public.posts FOR UPDATE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "posts author delete" ON public.posts FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- post_approvals
CREATE TABLE public.post_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  version_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_approvals_post ON public.post_approvals(post_id);
ALTER TABLE public.post_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals owner insert" ON public.post_approvals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "approvals owner select" ON public.post_approvals FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- post_shares
CREATE TABLE public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid,
  platform public.share_platform NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  referrer_clicks integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_shares_post ON public.post_shares(post_id);
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares owner insert" ON public.post_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "shares owner select" ON public.post_shares FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- post_reactions
CREATE TABLE public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind public.reaction_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, kind)
);
CREATE INDEX idx_reactions_post_kind ON public.post_reactions(post_id, kind);
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "reactions owner insert" ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions owner delete" ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Aggregate view for the reaction loop UI
CREATE OR REPLACE VIEW public.post_reaction_counts AS
SELECT post_id, kind, COUNT(*)::int AS count
FROM public.post_reactions
GROUP BY post_id, kind;
GRANT SELECT ON public.post_reaction_counts TO anon, authenticated;

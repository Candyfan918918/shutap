-- Spill The Tea™ draft workflow state
CREATE TYPE public.tea_status AS ENUM ('chatting', 'scoring', 'drafting', 'previewing', 'published', 'abandoned');

CREATE TABLE public.tea_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status public.tea_status NOT NULL DEFAULT 'chatting',
  locale text NOT NULL DEFAULT 'en',
  raw_dump text DEFAULT '',
  chat_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  ready_for_score boolean NOT NULL DEFAULT false,
  score integer,
  subscores jsonb,
  category text,
  category_key text,
  rankings jsonb,
  draft_variants jsonb,
  selected_tone text,
  selected_title text,
  selected_story text,
  cover_url text,
  cover_kind text,
  final_post_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tea_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_drafts owner select" ON public.tea_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tea_drafts owner insert" ON public.tea_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tea_drafts owner update" ON public.tea_drafts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tea_drafts owner delete" ON public.tea_drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tea_drafts_updated_at
  BEFORE UPDATE ON public.tea_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tea_drafts_user_id_idx ON public.tea_drafts(user_id, created_at DESC);

-- Allow anonymous uploads to story-media for authenticated users (org folder convention)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='story-media auth insert') THEN
    CREATE POLICY "story-media auth insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='story-media public read') THEN
    CREATE POLICY "story-media public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'story-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='story-media owner delete') THEN
    CREATE POLICY "story-media owner delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
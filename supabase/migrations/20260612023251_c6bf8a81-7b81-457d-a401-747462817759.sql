
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stories_moderation_status_check') THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_moderation_status_check
      CHECK (moderation_status IN ('pending','sensitive','removed','disputed','under_appeal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stories_moderation_status_idx ON public.stories(moderation_status);

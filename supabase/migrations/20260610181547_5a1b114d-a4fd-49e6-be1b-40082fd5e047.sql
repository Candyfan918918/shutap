ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS case_title text,
  ADD COLUMN IF NOT EXISTS question_before_court text;
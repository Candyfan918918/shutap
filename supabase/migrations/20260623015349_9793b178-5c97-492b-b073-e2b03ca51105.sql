-- 1) Move ip_hash off post_verdict_votes into a tightly-controlled side table.
CREATE TABLE IF NOT EXISTS public.post_verdict_vote_ips (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT ALL ON public.post_verdict_vote_ips TO service_role;
ALTER TABLE public.post_verdict_vote_ips ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role (server-side) reads/writes.

INSERT INTO public.post_verdict_vote_ips (post_id, user_id, ip_hash, created_at)
SELECT post_id, user_id, ip_hash, created_at
FROM public.post_verdict_votes
WHERE ip_hash IS NOT NULL
ON CONFLICT (post_id, user_id) DO NOTHING;

DROP INDEX IF EXISTS public.idx_pvv_ip_recent;
ALTER TABLE public.post_verdict_votes DROP COLUMN IF EXISTS ip_hash;
CREATE INDEX IF NOT EXISTS idx_pvvi_ip_recent
  ON public.post_verdict_vote_ips (ip_hash, created_at);

-- 2) post_views: stop exposing raw rows (session_hash, country) to authors.
DROP POLICY IF EXISTS "post_views author read" ON public.post_views;
REVOKE SELECT ON public.post_views FROM anon, authenticated;
-- Server functions use the service-role client; aggregates remain available there.

-- 3) profiles: restrict sensitive columns via column-level GRANTs,
--    and block all anon SELECT entirely (signed-out users no longer read profiles).
DROP POLICY IF EXISTS "profiles readable to all" ON public.profiles;
CREATE POLICY "profiles readable to authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, nickname, locale, country, region, city, emotional_embedding,
  created_at, updated_at, display_name, avatar_url, vibe, descriptor,
  city_label, country_code, onboarded_at, last_seen_at, handle, bio,
  anonymous_mode, avatar_kind, notif_prefs, privacy, nationality,
  emotion, creature, emoji, reroll_used, age_verified, phone_verified,
  justice_score, wisdom_score, empathy_score, prediction_score,
  juror_tier, juror_title, counsel_count, account_created_at
) ON public.profiles TO authenticated;
-- email, phone, dob, dob_month, dob_year, blocked_reason, blocked_at
-- are no longer readable through the Data API; service-role server functions
-- still read them for owner-only flows (getMyProfile, age gating, moderation).
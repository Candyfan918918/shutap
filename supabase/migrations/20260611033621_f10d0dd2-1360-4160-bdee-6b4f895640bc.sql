-- Lock down sensitive profile fields and stop broadcasting individual votes.

-- 1) Revoke column-level SELECT on PII from anon + authenticated.
REVOKE SELECT (email, phone, dob, dob_month, dob_year, blocked_reason)
  ON public.profiles FROM anon;
REVOKE SELECT (email, phone, dob, dob_month, dob_year, blocked_reason)
  ON public.profiles FROM authenticated;

-- service_role keeps full access for server-side admin work.
GRANT SELECT (email, phone, dob, dob_month, dob_year, blocked_reason)
  ON public.profiles TO service_role;

-- 2) Remove post_verdict_votes from the realtime publication so individual
--    vote rows are not broadcast to every subscriber. Aggregate tallies are
--    computed server-side; clients poll/refetch instead.
ALTER PUBLICATION supabase_realtime DROP TABLE public.post_verdict_votes;

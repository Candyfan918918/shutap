DROP VIEW IF EXISTS public.post_verdict_counts;
CREATE VIEW public.post_verdict_counts
WITH (security_invoker = true) AS
SELECT post_id, kind, COUNT(*)::int AS count
FROM public.post_verdict_votes
GROUP BY post_id, kind;

GRANT SELECT ON public.post_verdict_counts TO anon, authenticated;
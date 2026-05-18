
DROP VIEW IF EXISTS public.post_reaction_counts;
CREATE VIEW public.post_reaction_counts
WITH (security_invoker = true) AS
SELECT post_id, kind, COUNT(*)::int AS count
FROM public.post_reactions
GROUP BY post_id, kind;
GRANT SELECT ON public.post_reaction_counts TO anon, authenticated;

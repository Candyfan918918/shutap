
REVOKE EXECUTE ON FUNCTION public._trg_maybe_nominate_vote() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._trg_maybe_nominate_relate() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._trg_maybe_nominate_persp() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._trg_maybe_nominate_comment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.finalize_court_cases() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.nominate_court_cases(text, text, text, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.promote_court_cases() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.finalize_court_cases() TO service_role;
GRANT EXECUTE ON FUNCTION public.nominate_court_cases(text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_court_cases() TO service_role;

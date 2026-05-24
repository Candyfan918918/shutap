
REVOKE EXECUTE ON FUNCTION public.nominate_court_cases(text, text, text, int) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.promote_court_cases() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.finalize_court_cases() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.nominate_court_cases(text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_court_cases() TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_court_cases() TO service_role;

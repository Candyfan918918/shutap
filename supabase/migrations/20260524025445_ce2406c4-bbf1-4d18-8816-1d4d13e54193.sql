
REVOKE EXECUTE ON FUNCTION public._bump_post_counter(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._slugify_handle(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_comment_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_reaction_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_share_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_forward_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_saved_post_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.suggest_handles(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_handle_available(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_friend(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

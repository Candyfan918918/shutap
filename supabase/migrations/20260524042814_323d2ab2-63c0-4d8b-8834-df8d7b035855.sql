REVOKE EXECUTE ON FUNCTION public._on_pur_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_update_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._on_post_update_delete() FROM PUBLIC, anon, authenticated;
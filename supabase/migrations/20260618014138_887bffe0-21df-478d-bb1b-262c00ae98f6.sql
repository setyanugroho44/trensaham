REVOKE EXECUTE ON FUNCTION public.auto_close_stale_tickets() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_delete_old_tickets() FROM anon, authenticated, PUBLIC;
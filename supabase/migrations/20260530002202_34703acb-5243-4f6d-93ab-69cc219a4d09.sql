REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_patterns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_duplicate_patterns() TO postgres, service_role;
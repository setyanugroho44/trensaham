-- app_config holds server-only configuration/secrets and is accessed exclusively
-- through SECURITY DEFINER functions (e.g. handle_new_user) which bypass RLS.
-- Add an explicit deny-all policy to document intent and satisfy the linter.
CREATE POLICY "Deny all client access to app_config"
ON public.app_config
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.app_config IS 'Server-only configuration/secrets. Accessed exclusively via SECURITY DEFINER functions. Deny-all RLS policy blocks all direct client access by design.';
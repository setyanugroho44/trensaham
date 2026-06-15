CREATE OR REPLACE FUNCTION public.is_support_agent(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN ('setyanugroho44@gmail.com', 'myadhi70@yahoo.com')
  )
$function$;
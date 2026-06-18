-- Auto-close support tickets after 48 hours of no reply, and
-- auto-delete tickets after 6 months of inactivity.

-- Helper function: close stale open tickets (no activity for 48h)
CREATE OR REPLACE FUNCTION public.auto_close_stale_tickets()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.support_tickets
  SET status = 'closed'
  WHERE status = 'open'
    AND updated_at < now() - interval '48 hours';
$$;

-- Helper function: delete tickets inactive for 6 months
-- (support_messages cascade-delete via FK)
CREATE OR REPLACE FUNCTION public.auto_delete_old_tickets()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.support_tickets
  WHERE updated_at < now() - interval '6 months';
$$;

-- Schedule: close stale tickets hourly
SELECT cron.schedule(
  'auto-close-stale-tickets',
  '0 * * * *',
  $$ SELECT public.auto_close_stale_tickets(); $$
);

-- Schedule: delete old tickets daily at 03:00 UTC
SELECT cron.schedule(
  'auto-delete-old-tickets',
  '0 3 * * *',
  $$ SELECT public.auto_delete_old_tickets(); $$
);
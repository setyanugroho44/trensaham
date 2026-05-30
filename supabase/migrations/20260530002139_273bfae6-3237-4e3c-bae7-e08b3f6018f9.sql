-- Enable scheduler extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: remove duplicate harmonic patterns across the whole database,
-- keeping only the most recent row per logical pattern.
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_patterns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY user_id, symbol, timeframe, pattern_name, direction, status, prz_low, prz_high
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.patterns
  ),
  removed AS (
    DELETE FROM public.patterns p
    USING ranked r
    WHERE p.id = r.id AND r.rn > 1
    RETURNING p.id
  )
  SELECT count(*) INTO deleted_count FROM removed;
  RETURN deleted_count;
END;
$$;

-- Schedule weekly cleanup: every Sunday at 00:00 UTC
SELECT cron.unschedule('weekly-dedupe-patterns')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-dedupe-patterns');

SELECT cron.schedule(
  'weekly-dedupe-patterns',
  '0 0 * * 0',
  $$ SELECT public.cleanup_duplicate_patterns(); $$
);
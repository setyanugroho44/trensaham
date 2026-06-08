-- Correct stale invalidation levels for AB=CD patterns created before the
-- invalidation fix. For AB=CD the invalidation is the far edge of the PRZ
-- (a break beyond the reversal zone voids the pattern):
--   bullish -> below the PRZ (prz_low)
--   bearish -> above the PRZ (prz_high)
UPDATE public.patterns
SET invalidation = prz_low
WHERE pattern_name = 'AB=CD'
  AND direction = 'bullish'
  AND prz_low IS NOT NULL
  AND invalidation IS DISTINCT FROM prz_low;

UPDATE public.patterns
SET invalidation = prz_high
WHERE pattern_name = 'AB=CD'
  AND direction = 'bearish'
  AND prz_high IS NOT NULL
  AND invalidation IS DISTINCT FROM prz_high;
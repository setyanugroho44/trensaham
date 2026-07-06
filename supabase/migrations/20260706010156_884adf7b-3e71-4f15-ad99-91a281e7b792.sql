CREATE TABLE public.web_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL DEFAULT 'direct',
  referrer_url text,
  referrer_domain text,
  search_engine text,
  search_keyword text,
  landing_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  user_agent text
);

CREATE INDEX idx_web_visits_created_at ON public.web_visits (created_at DESC);
CREATE INDEX idx_web_visits_source_type ON public.web_visits (source_type);
CREATE INDEX idx_web_visits_search_keyword ON public.web_visits (search_keyword);
CREATE INDEX idx_web_visits_referrer_domain ON public.web_visits (referrer_domain);

GRANT ALL ON public.web_visits TO service_role;

ALTER TABLE public.web_visits ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: inserts are performed by the service role via a
-- server function, and reads are performed by admins via the service role.
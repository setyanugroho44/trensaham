CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Only service role can write app settings" ON public.app_settings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
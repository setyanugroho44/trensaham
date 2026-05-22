
-- Promote the requested email to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'setyanugroho44@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro')),
  trial_ends_at timestamptz,
  pro_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin select subscriptions" ON public.subscriptions
  FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "admin update subscriptions" ON public.subscriptions
  FOR UPDATE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "admin insert subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill subscriptions for existing users with 14 day trial from now
INSERT INTO public.subscriptions (user_id, tier, trial_ends_at)
SELECT u.id, 'free', now() + interval '14 days'
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL;

-- Update handle_new_user to also create a 14-day trial subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.subscriptions (user_id, tier, trial_ends_at)
    VALUES (NEW.id, 'free', now() + interval '14 days')
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: does user currently have active access?
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id,'admin')
    OR public.has_role(_user_id,'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND (
          (s.tier = 'pro' AND s.pro_ends_at IS NOT NULL AND s.pro_ends_at > now())
          OR (s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now())
        )
    );
$$;

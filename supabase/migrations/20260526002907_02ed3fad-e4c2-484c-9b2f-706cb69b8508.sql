
-- Payment requests
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('pro_6m','pro_12m')),
  base_amount integer NOT NULL,
  unique_code integer NOT NULL,
  total_amount integer NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','rejected','cancelled')),
  admin_note text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payment select" ON public.payment_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own payment insert" ON public.payment_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payment update pending" ON public.payment_requests
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending','submitted'));
CREATE POLICY "admin payment select" ON public.payment_requests
  FOR SELECT USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin payment update" ON public.payment_requests
  FOR UPDATE USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_requests_user ON public.payment_requests(user_id, created_at DESC);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status, created_at DESC);

-- Storage bucket for transfer proofs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs','payment-proofs', false);

CREATE POLICY "users upload own proof" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "users read own proof" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "users update own proof" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "admin read all proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-proofs'
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

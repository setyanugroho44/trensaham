-- CMS pages table
CREATE TABLE public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

-- Public can read public pages
CREATE POLICY "public read public pages"
ON public.cms_pages FOR SELECT
TO anon, authenticated
USING (visibility = 'public');

-- Authenticated users can read private pages
CREATE POLICY "authenticated read private pages"
ON public.cms_pages FOR SELECT
TO authenticated
USING (visibility = 'private');

-- Admins manage all
CREATE POLICY "admin manage pages"
ON public.cms_pages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- updated_at trigger
CREATE TRIGGER cms_pages_updated_at
BEFORE UPDATE ON public.cms_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed landing page
INSERT INTO public.cms_pages (slug, title, visibility, sections) VALUES (
  'landing',
  'IDX Harmonic Scanner',
  'public',
  '[
    {"id":"hero","heading":"Scanner Pola Harmonik Saham Indonesia","content":"<p>Deteksi otomatis pola harmonik (Gartley, Bat, Crab, Butterfly, dll) pada saham IDX. Dapatkan sinyal entry dengan zona PRZ yang jelas, target, dan stop loss.</p><p><strong>Coba gratis 14 hari, tanpa kartu kredit.</strong></p>"},
    {"id":"features","heading":"Mengapa pakai scanner ini?","content":"<ul><li><strong>Otomatis</strong> — scan ratusan saham IDX dalam hitungan menit.</li><li><strong>Akurat</strong> — validasi rasio Fibonacci sesuai aturan masing-masing pola.</li><li><strong>Watchlist & Trailing Stop</strong> — pantau saham favorit dan kelola risiko.</li><li><strong>Chart interaktif</strong> — visualisasi pola XABCD lengkap dengan zona PRZ.</li></ul>"},
    {"id":"faq","heading":"Pertanyaan Umum","content":"<p><strong>Apakah saya butuh akun broker?</strong></p><p>Tidak. Scanner hanya menganalisis data harga publik dari Yahoo Finance (.JK).</p><p><strong>Apa bedanya Free dan Pro?</strong></p><p>Free dibatasi jumlah scan per hari. Pro mendapatkan scan unlimited, alert, dan akses semua timeframe.</p><p><strong>Apakah ini saran investasi?</strong></p><p>Tidak. Scanner ini alat bantu analisis teknikal untuk tujuan edukasi. Keputusan investasi tetap di tangan Anda.</p>"}
  ]'::jsonb
);

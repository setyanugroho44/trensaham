import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { FacebookPixel } from "@/components/facebook-pixel";
import { Button } from "@/components/ui/button";
import { TrendingUp, ListChecks, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Analisa Saham yang Akan Naik — Scanner pola saham Indonesia" },
      {
        name: "description",
        content:
          "Scanner teknikal harga saham Indonesia. Analisis pergerakan saham yang Mudah dan Cepat Cocok untuk yang sibuk dan tidak ingin ribet. Metode Analisa Saham Harmonic Pattern",
      },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <FacebookPixel />
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">Analisa Saham Indo</Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm"><Link to="/dashboard">Buka Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Masuk</Link></Button>
                <Button asChild size="sm"><Link to="/signup">Daftar Gratis</Link></Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Scanner Saham Indonesia - Pola Harmonik 
          </h1>
  
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground">
            Analisa Saham yang Akan Naik. Prediksi kemana harga akan bergerak hanya dengan satu tombol.
            Deteksi otomatis pola harmonik saham.
            Hemat waktu analisa, fokus pada eksekusi.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {user ? (
              <Button asChild size="lg"><Link to="/dashboard">Buka Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild size="lg"><Link to="/signup">Daftar</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/login">Sudah punya akun</Link></Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Fitur Utama</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
            Scan dan kelola posisi berbasis pola harmonik.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FeatureCard icon={Activity} label="Pattern Detection" />
            <FeatureCard icon={ListChecks} label="Watchlist" />
            <FeatureCard icon={TrendingUp} label="Trailing Stop" />
            <FeatureCard icon={ShieldCheck} label="Risk Management" />
          </div>
        </div>
      </section>
      {/* How it works */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Mengapa AnalisaSahamIndo.com?</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BenefitCard title="Cepat" desc="Scan puluhan saham IDX dalam hitungan detik." />
            <BenefitCard title="Mudah" desc="Validasi rasio Fibonacci sesuai aturan masing-masing pola." />
            <BenefitCard title="Watchlist & Trailing Stop" desc="Pantau saham favorit dan kelola risiko." />
            <BenefitCard title="Chart Interaktif" desc="Visualisasi pola lengkap dengan zona Pembalikan harga saham." />
          </div>
        </div>
      </section>
      {/* FAQ */}
      <section className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">Pertanyaan Umum</h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="font-semibold">Apa itu pola harmonik?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                adalah metode analisis teknikal pada grafik saham menggunakan rasio Fibonacci untuk mendeteksi pola geometris yang berulang. Sederhananya, pola ini berdasar pergerakan harga pasar yang memiliki siklus alami seperti gelombang. Dengan menggabungkan geometri dan matematika tersebut, trader bisa memprediksi titik jenuh pasar—yaitu kapan harga yang sedang naik akan berbalik turun, atau kapan harga yang sedang turun akan mulai melonjak naik kembali.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Apakah informasinya dapat dipercaya?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Meskipun tingkat keberhasilan pola harmonic cukup tinggi, tidak ada analisis teknikal yang sempurna.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Apa saya perlu belajar pola harmonik?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tidak harus, kami bangun scanner ini semudah mungkin sehingga mudah dimengerti tetapi kalau anda mempelajari dan mengerti pola harmonik itu lebih bagus
              </p>
            </div>
            

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Analisa <a href="https://analisasahamindo.my.id">saham</a> yang akan naik. </p>
          <p className="mt-1">Kami sajikan data keputusan investasi tanggung jawab investor</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-4 text-center">
      <Icon className="h-6 w-6 text-primary" />
      <div className="text-sm font-medium">{label}</div>
    </div>
  );
}

function BenefitCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-4 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

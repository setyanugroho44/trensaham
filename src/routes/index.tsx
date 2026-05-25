import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TrendingUp, ListChecks, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "IDX Harmonic Scanner — Deteksi pola harmonik saham Indonesia" },
      {
        name: "description",
        content:
          "Scanner otomatis pola harmonik (Gartley, Bat, Crab, Butterfly) untuk saham IDX. Coba gratis 14 hari.",
      },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">IDX Harmonic</Link>
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
            Scanner Pola Harmonik Saham Indonesia
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground">
            Deteksi otomatis pola harmonik (Gartley, Bat, Crab, Butterfly) pada saham IDX.
            Hemat waktu analisa, fokus pada eksekusi.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {user ? (
              <Button asChild size="lg"><Link to="/dashboard">Buka Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild size="lg"><Link to="/signup">Mulai Gratis 14 Hari</Link></Button>
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
            Semua yang Anda butuhkan untuk memindai dan mengelola posisi berbasis pola harmonik.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FeatureCard icon={Activity} label="Pattern Detection" />
            <FeatureCard icon={ListChecks} label="Watchlist" />
            <FeatureCard icon={TrendingUp} label="Trailing Stop" />
            <FeatureCard icon={ShieldCheck} label="Risk Management" />
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
                Pola harmonik adalah struktur harga berbasis rasio Fibonacci (Gartley, Bat, Crab,
                Butterfly) yang memberi area reversal dengan risk/reward yang terdefinisi.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Apakah ada masa percobaan?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ya, semua pengguna baru mendapat 14 hari gratis untuk mencoba seluruh fitur.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Sumber data?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Data harga diambil dari Yahoo Finance (suffix .JK) untuk saham Indonesia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} IDX Harmonic Scanner. Educational use only — not investment advice.</p>
          <p className="mt-1">Data: Yahoo Finance (.JK).</p>
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

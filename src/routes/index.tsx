import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicPage } from "@/lib/cms.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TrendingUp, ListChecks, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "IDX Harmonic Scanner — Deteksi pola harmonik saham Indonesia" },
      { name: "description", content: "Scanner otomatis pola harmonik (Gartley, Bat, Crab, Butterfly) untuk saham IDX. Coba gratis 14 hari." },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["cms-public", "landing"],
    queryFn: () => getPublicPage({ data: { slug: "landing" } }),
  });

  const page = data?.page;
  const hero = page?.sections.find((s) => s.id === "hero");
  const features = page?.sections.find((s) => s.id === "features");
  const faq = page?.sections.find((s) => s.id === "faq");
  const extras = page?.sections.filter((s) => !["hero", "features", "faq"].includes(s.id)) ?? [];

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
            {hero?.heading || "Scanner Pola Harmonik Saham Indonesia"}
          </h1>
          <div
            className="prose prose-sm dark:prose-invert mx-auto mt-6 max-w-2xl text-base"
            dangerouslySetInnerHTML={{
              __html:
                hero?.content ||
                "<p>Deteksi otomatis pola harmonik pada saham IDX.</p>",
            }}
          />
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
      {features && (
        <section className="border-b">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              {features.heading || "Fitur"}
            </h2>
            <div
              className="prose prose-sm dark:prose-invert mx-auto mt-6 max-w-3xl"
              dangerouslySetInnerHTML={{ __html: features.content }}
            />
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FeatureCard icon={Activity} label="Pattern Detection" />
              <FeatureCard icon={ListChecks} label="Watchlist" />
              <FeatureCard icon={TrendingUp} label="Trailing Stop" />
              <FeatureCard icon={ShieldCheck} label="Risk Management" />
            </div>
          </div>
        </section>
      )}

      {/* Extra admin-added sections */}
      {extras.map((s) => (
        <section key={s.id} className="border-b">
          <div className="mx-auto max-w-3xl px-4 py-16">
            {s.heading && <h2 className="text-3xl font-semibold tracking-tight">{s.heading}</h2>}
            <div
              className="prose prose-sm dark:prose-invert mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: s.content }}
            />
          </div>
        </section>
      ))}

      {/* FAQ */}
      {faq && (
        <section className="border-b">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-3xl font-semibold tracking-tight">
              {faq.heading || "Pertanyaan Umum"}
            </h2>
            <div
              className="prose prose-sm dark:prose-invert mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: faq.content }}
            />
          </div>
        </section>
      )}

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

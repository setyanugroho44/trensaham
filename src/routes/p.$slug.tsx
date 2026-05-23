import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicPage, getPageForUser, type CmsPage } from "@/lib/cms.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPage,
});

function PublicPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const publicQ = useQuery({
    queryKey: ["cms-public", slug],
    queryFn: () => getPublicPage({ data: { slug } }),
  });

  const authedQ = useQuery({
    queryKey: ["cms-authed", slug],
    queryFn: () => getPageForUser({ data: { slug } }),
    enabled: !!user && publicQ.data?.page === null,
  });

  const page: CmsPage | null = publicQ.data?.page ?? authedQ.data?.page ?? null;
  const isLoading = publicQ.isLoading || (publicQ.data?.page === null && !!user && authedQ.isLoading);

  useEffect(() => {
    if (!loading && !user && publicQ.data && publicQ.data.page === null) {
      // Could be private — redirect to login
      navigate({ to: "/login" });
    }
  }, [loading, user, publicQ.data, navigate]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat…</div>;
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">Halaman "{slug}" tidak tersedia.</p>
          <Link to="/" className="mt-4 inline-block text-primary underline">Kembali ke beranda</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">IDX Harmonic</Link>
          <div className="flex gap-2">
            {user ? (
              <Button asChild size="sm"><Link to="/dashboard">Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Masuk</Link></Button>
                <Button asChild size="sm"><Link to="/signup">Daftar</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
        <div className="mt-8 space-y-10">
          {page.sections.map((s) => (
            <section key={s.id}>
              {s.heading && <h2 className="text-2xl font-semibold tracking-tight">{s.heading}</h2>}
              <div
                className="prose prose-sm dark:prose-invert mt-3 max-w-none"
                dangerouslySetInnerHTML={{ __html: s.content }}
              />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

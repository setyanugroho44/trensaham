import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
            <SidebarTrigger className="h-9 w-9 [&>svg]:h-5 [&>svg]:w-5" />
            <Link to="/dashboard" className="text-base font-semibold tracking-tight">
              IDX Harmonic Scanner
            </Link>
          </header>
          <main className="flex-1 px-4 py-6">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
          <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
            Educational use only — not investment advice. Data: Yahoo Finance (.JK).
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

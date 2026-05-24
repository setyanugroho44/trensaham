import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/verified")({
  component: VerifiedPage,
  head: () => ({ meta: [{ title: "Email Terverifikasi — Analisa Saham Indo" }] }),
});

function VerifiedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Email Anda Telah Terverifikasi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Akun Anda sudah aktif.{" "}
            <Link
              to="/login"
              className="text-primary underline font-medium"
            >
              Lanjut Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

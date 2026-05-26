import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralStats } from "@/lib/referral.functions";
import { encodeRef } from "@/lib/referral-code";

export const Route = createFileRoute("/_authenticated/referral")({
  component: ReferralPage,
  head: () => ({ meta: [{ title: "Referral — IDX Harmonic Scanner" }] }),
});

function ReferralPage() {
  const fn = useServerFn(getMyReferralStats);
  const [code, setCode] = useState("");
  const [count, setCount] = useState(0);
  const origin = "https://analisasahamindo.com";
  const link = code ? `${origin}/?r=${encodeRef(code)}` : "";

  useEffect(() => {
    fn().then((r) => {
      setCode(r.code);
      setCount(r.count);
    }).catch(() => {});
  }, [fn]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link tersalin");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bagikan Link Referral</h1>
        <p className="text-sm text-muted-foreground">
          Setiap orang yang mendaftar lewat link Anda, masa keanggotaan Anda diperpanjang 14 hari (berlaku untuk Free maupun Pro).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link Anda</CardTitle>
          <CardDescription>Salin dan sebarkan ke teman Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={link} readOnly />
            <Button onClick={copy} disabled={!link}>
              <Copy className="h-4 w-4 mr-1" /> Salin
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Total pendaftar via link Anda: <span className="font-semibold text-foreground">{count}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

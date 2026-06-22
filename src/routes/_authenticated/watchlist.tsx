import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getMyAccess } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/watchlist")({
  component: WatchlistPage,
  head: () => ({ meta: [{ title: "Watchlist — Analisa Saham Indo" }] }),
});

function WatchlistPage() {
  const [symbols, setSymbols] = useState<{ id: string; symbol: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<"free" | "pro">("free");
  const fetchAccess = useServerFn(getMyAccess);
  const MAX_SYMBOLS = tier === "pro" ? 50 : 30;
  const tierLabel = tier === "pro" ? "Pro" : "Free";

  const load = async () => {
    const { data, error } = await supabase
      .from("watchlist_symbols")
      .select("id,symbol")
      .order("symbol");
    if (error) toast.error(error.message);
    else setSymbols(data ?? []);
  };

  useEffect(() => {
    load();
    fetchAccess()
      .then((a) => setTier(a.tier))
      .catch(() => {});
  }, [fetchAccess]);

  const addBulk = async () => {
    const codes = Array.from(
      new Set(
        input
          .split(/[\s,;\n]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z0-9.-]{1,15}$/.test(s)),
      ),
    );
    if (codes.length === 0) {
      toast.warning("Enter at least one valid stock code");
      return;
    }
    if (symbols.length + codes.length > MAX_SYMBOLS) {
      toast.error(`Watchlist is limited to ${MAX_SYMBOLS} symbols. You currently have ${symbols.length}.`);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setLoading(true);
    const rows = codes.map((symbol) => ({ symbol, user_id: u.user!.id }));
    const { error } = await supabase
      .from("watchlist_symbols")
      .upsert(rows, { onConflict: "user_id,symbol", ignoreDuplicates: true });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Added ${codes.length} symbol(s)`);
      setInput("");
      load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("watchlist_symbols").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted-foreground">Kode saham yang akan di scan (cth. ASII, TLKM, ULTJ).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tambah Saham</CardTitle>
          <CardDescription>Akun {tierLabel} maksimal {MAX_SYMBOLS} kode saham. Paste beberapa kode saham pisahkan dengan spasi, koma, atau baris baru. Disarankan isi &gt; 20 saham.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"ASII\nTLKM\nUNVR, BBCA, BBRI"}
            rows={5}
          />
          <Button onClick={addBulk} disabled={loading}>
            {loading ? "Adding…" : "Add to watchlist"}
          </Button>
        </CardContent>
      </Card>

      

      <Card>
        <CardHeader>
          <CardTitle>Your symbols ({symbols.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {symbols.length === 0 ? (
            <p className="text-sm text-muted-foreground">No symbols yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {symbols.map((s) => (
                <Badge key={s.id} variant="secondary" className="gap-1 px-2 py-1 text-sm">
                  {s.symbol}
                  <button
                    onClick={() => remove(s.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                    aria-label={`Remove ${s.symbol}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          
          <CardDescription>
            IHSG otomatis ikut dipindai bersama watchlist, ditampilkan jika scanner menemukan pola.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

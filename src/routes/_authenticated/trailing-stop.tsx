import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { fetchBarsForSymbol } from "@/lib/scan.functions";
import type { Bar } from "@/lib/harmonic/types";

export const Route = createFileRoute("/_authenticated/trailing-stop")({
  component: TrailingStopPage,
  head: () => ({ meta: [{ title: "Trailing Stop — IDX Harmonic Scanner" }] }),
});

type Result = {
  symbol: string;
  lastClose: number;
  atr: number;
  atrPct: number;
  rows: { k: number; pct: number; stop: number }[];
};

function computeATR(bars: Bar[], period: number): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const p = Math.min(period, trs.length);
  // Wilder's smoothing
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < trs.length; i++) {
    atr = (atr * (p - 1) + trs[i]) / p;
  }
  return atr;
}

function TrailingStopPage() {
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const fetchBars = useServerFn(fetchBarsForSymbol);

  const calculate = async () => {
    const code = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(code)) {
      toast.warning("Masukkan kode saham yang valid");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Try daily first, fall back to weekly then monthly if Yahoo returns nothing
      // (e.g. rate-limited or delisted ticker).
      const tfs: Array<"1d" | "1wk" | "1mo"> = ["1d", "1wk", "1mo"];
      let bars: Bar[] = [];
      let usedTf: string = "1d";
      let lastErr: string | null = null;
      for (const tf of tfs) {
        try {
          const r = await fetchBars({ data: { symbol: code, timeframe: tf } });
          if (r.bars && r.bars.length >= 5) {
            bars = r.bars;
            usedTf = tf;
            break;
          }
        } catch (e) {
          lastErr = (e as Error).message;
        }
      }
      if (!bars.length) {
        toast.error(lastErr ?? "Data tidak tersedia untuk simbol ini");
        return;
      }
      const period = Math.min(14, Math.max(2, bars.length - 1));
      const atr = computeATR(bars, period);
      const lastClose = bars[bars.length - 1].close;
      const atrPct = (atr / lastClose) * 100;
      const rows = [1.5, 2, 2.5, 3].map((k) => ({
        k,
        pct: (k * atr / lastClose) * 100,
        stop: lastClose - k * atr,
      }));
      setResult({ symbol: `${code} (${usedTf}, n=${bars.length})`, lastClose, atr, atrPct, rows });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trailing Stop</h1>
        <p className="text-sm text-muted-foreground">
          Hitung trailing stop berbasis ATR(14) pada timeframe harian.
        </p>
      </div>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">Kombinasi dengan Pola Harmonik</p>
              <p>
                Tool ini dirancang untuk dipadukan dengan pola harmonik. Setelah harga mencapai <strong>PRZ</strong> (Potential Reversal Zone) dan berbalik arah, ambil <strong>taking profit sebagian</strong> di level Fibonacci <strong>0,382</strong>.
              </p>
              <p>
                Kemudian pasang <strong>trailing stop</strong> pada posisi sisa agar profit dapat terus berjalan mengikuti tren hingga tren tersebut benar-benar patah.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kode Saham</CardTitle>
          <CardDescription>Contoh: ASII, BBCA, TLKM (suffix .JK otomatis ditambahkan).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="sym">Symbol</Label>
            <Input
              id="sym"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="ASII"
              onKeyDown={(e) => e.key === "Enter" && calculate()}
            />
          </div>
          <Button onClick={calculate} disabled={loading}>
            {loading ? "Menghitung…" : "Hitung Trailing Stop"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{result.symbol}</CardTitle>
            <CardDescription>
              Harga terakhir: <span className="font-medium text-foreground">{result.lastClose.toFixed(2)}</span>
              {" · "}ATR(14): <span className="font-medium text-foreground">{result.atr.toFixed(2)}</span>
              {" · "}ATR%: <span className="font-medium text-foreground">{result.atrPct.toFixed(2)}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Multiplier (k × ATR)</th>
                    <th className="py-2">Trailing Stop %</th>
                    <th className="py-2">Stop Price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.k} className="border-t border-border">
                      <td className="py-2">{r.k} × ATR</td>
                      <td className="py-2 font-medium">{r.pct.toFixed(2)}%</td>
                      <td className="py-2">{r.stop.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Trailing stop% = (k × ATR) / harga terakhir × 100. Multiplier umum: 2 (ketat), 3 (longgar).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchBarsForSymbol, reevaluatePattern } from "@/lib/scan.functions";
import { floorToIdxTick, ceilToIdxTick, idxTickSize } from "@/lib/harmonic/detect";

import { toast } from "sonner";

function roundToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.round(price / t) * t;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Info, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Bar } from "@/lib/harmonic/types";

const searchSchema = z.object({
  tf: z.enum(["1h", "1d", "1wk", "1mo"]).optional().default("1wk"),
  pid: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/chart/$symbol")({
  validateSearch: searchSchema,
  component: ChartPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.symbol} chart — Analisa Saham Indo` }],
  }),
});

type PatternRow = {
  id: string;
  symbol: string;
  pattern_name: string;
  direction: "bullish" | "bearish";
  status: "completed" | "developing" | "invalid";
  confidence: number;
  x_date: string | null; x_price: number | null;
  a_date: string; a_price: number;
  b_date: string; b_price: number;
  c_date: string; c_price: number;
  d_date: string | null; d_price: number | null;
  prz_low: number | null; prz_high: number | null;
  invalidation: number | null;
  progress_pct: number | null;
  ratios: Record<string, number> | null;
};

function ChartPage() {
  const { symbol } = Route.useParams();
  const { tf, pid } = Route.useSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [pattern, setPattern] = useState<PatternRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [targetReached, setTargetReached] = useState<number | null>(null);
  const fetchBars = useServerFn(fetchBarsForSymbol);
  const reevaluate = useServerFn(reevaluatePattern);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!pattern) return;
    setDeleting(true);
    const { error } = await supabase.from("patterns").delete().eq("id", pattern.id);
    setDeleting(false);
    if (error) {
      toast.error("Gagal menghapus pola: " + error.message);
      return;
    }
    toast.success("Pola berhasil dihapus");
    navigate({ to: "/dashboard" });
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchBars({ data: { symbol, timeframe: tf } }).catch(() => ({ bars: [] })),
      pid
        ? supabase.from("patterns").select("*").eq("id", pid).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([bRes, pRes]) => {
      if (!alive) return;
      setBars(bRes.bars);
      const row = (pRes as { data: PatternRow | null }).data;
      setPattern(row);
      setLoading(false);

      // Hitung ulang status pola berdasarkan harga terbaru (mis. sudah memantul
      // dari PRZ → completed, atau menembus invalidation → invalid). Jalan di
      // latar belakang agar tidak menahan render chart.
      if (row && pid && (row.status === "developing" || row.status === "completed")) {
        reevaluate({ data: { patternId: pid } })
          .then((res) => {
            if (!alive || !res || !res.changed || !res.status) return;
            setPattern((prev) =>
              prev && prev.id === pid
                ? {
                    ...prev,
                    status: res.status as PatternRow["status"],
                    d_date: res.d_date ?? prev.d_date,
                    d_price: res.d_price ?? prev.d_price,
                  }
                : prev,
            );
          })
          .catch(() => {});
      }
    });
    return () => {
      alive = false;
    };
  }, [symbol, tf, pid, fetchBars, reevaluate]);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    let chart: any;
    let onResize: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const lib = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const { createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } = lib as any;
      // lightweight-charts can't parse oklch(); resolve theme color to rgb via canvas.
      const isDark = document.documentElement.classList.contains("dark");
      const textColor = isDark ? "#e5e7eb" : "#374151";
      chart = createChart(containerRef.current, {
        height: 500,
        layout: {
          background: { color: "rgba(0,0,0,0)" },
          textColor,
        },
        grid: {
          vertLines: { color: "rgba(120,120,120,0.1)" },
          horzLines: { color: "rgba(120,120,120,0.1)" },
        },
        timeScale: { timeVisible: tf !== "1d" },
        rightPriceScale: { borderVisible: false },
      });

      // Volume histogram di dalam chart utama (skala terpisah di bagian bawah).
      const hasVolume = bars.some((b) => b.volume != null && b.volume > 0);
      if (hasVolume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        volume.setData(
          bars.map((b) => ({
            time: b.time as any,
            value: b.volume ?? 0,
            color:
              b.close >= b.open ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
          })),
        );
      }

      const candle = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });
      candle.setData(
        bars.map((b) => ({
          time: b.time as any,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );

      if (pattern) {
        const pts: { time: number; price: number; label: string }[] = [];
        // Pada pola AB=CD kaki X tidak relevan, jadi tidak digambar.
        if (pattern.x_date && pattern.x_price != null && pattern.pattern_name !== "AB=CD")
          pts.push({ time: Date.parse(pattern.x_date) / 1000, price: pattern.x_price, label: "X" });
        pts.push({ time: Date.parse(pattern.a_date) / 1000, price: pattern.a_price, label: "A" });
        pts.push({ time: Date.parse(pattern.b_date) / 1000, price: pattern.b_price, label: "B" });
        pts.push({ time: Date.parse(pattern.c_date) / 1000, price: pattern.c_price, label: "C" });
        if (pattern.d_date && pattern.d_price != null)
          pts.push({ time: Date.parse(pattern.d_date) / 1000, price: pattern.d_price, label: "D" });

        pts.sort((a, b) => a.time - b.time);
        const line = chart.addSeries(LineSeries, {
          color: pattern.direction === "bullish" ? "#10b981" : "#ef4444",
          lineWidth: 2,
        });
        line.setData(pts.map((p) => ({ time: p.time as any, value: p.price })));
        line.setMarkers(
          pts.map((p) => ({
            time: p.time as any,
            position: "inBar" as const,
            color: pattern.direction === "bullish" ? "#10b981" : "#ef4444",
            shape: "circle" as const,
            text: p.label,
          })),
        );

        // Garis dari titik C ke candle terakhir untuk pola developing,
        // menunjukkan pergerakan harga aktual sejak titik C terbentuk.
        if (pattern.status === "developing" && (!pattern.d_date || pattern.d_price == null)) {
          const cTime = Date.parse(pattern.c_date) / 1000;
          const lastBar = bars[bars.length - 1];
          if (cTime < lastBar.time) {
            const legLine = chart.addSeries(LineSeries, {
              color: pattern.direction === "bullish" ? "#10b981" : "#ef4444",
              lineWidth: 2,
              lineStyle: 0, // solid
              lastValueVisible: false,
              priceLineVisible: false,
            });
            legLine.setData([
              { time: cTime as any, value: pattern.c_price },
              { time: lastBar.time as any, value: lastBar.close },
            ]);
          }
        }

        if (pattern.prz_low != null && pattern.prz_high != null) {
          const lastTime = bars[bars.length - 1].time;
          // 2 garis horizontal penuh untuk menandai batas atas & bawah PRZ
          candle.createPriceLine({
            price: pattern.prz_high,
            color: "rgba(168, 85, 247, 0.9)",
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "PRZ High",
          });
          candle.createPriceLine({
            price: pattern.prz_low,
            color: "rgba(168, 85, 247, 0.9)",
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "PRZ Low",
          });

          // Garis proyeksi C → PRZ (midpoint). Untuk pola developing,
          // tunjukkan arah perkiraan kaki C-D menuju zona reversal.
          if (!pattern.d_date || pattern.d_price == null) {
            const cTime = Date.parse(pattern.c_date) / 1000;
            if (cTime < lastTime) {
              const przMid = (pattern.prz_low + pattern.prz_high) / 2;
              const projLine = chart.addSeries(LineSeries, {
                color: "rgba(168, 85, 247, 0.9)",
                lineWidth: 2,
                lineStyle: 2, // dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              projLine.setData([
                { time: cTime as any, value: pattern.c_price },
                { time: lastTime as any, value: przMid },
              ]);
              projLine.setMarkers([
                {
                  time: lastTime as any,
                  position: "inBar" as const,
                  color: "rgba(168, 85, 247, 0.9)",
                  shape: "circle" as const,
                  text: "D?",
                },
              ]);
            }
          }
        }

        // Target konservatif hanya untuk pola completed bullish: retracement 0.382 dari kaki A→D
        if (pattern.status === "completed" && pattern.d_price != null && pattern.direction !== "bearish") {
          const target = pattern.d_price + 0.382 * (pattern.a_price - pattern.d_price);
          candle.createPriceLine({
            price: target,
            color: "rgba(16, 185, 129, 0.9)",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "Target 0.382 AD",
          });
        }
      }

      if (cancelled) {
        // Effect sudah di-cleanup sebelum sampai sini — buang chart yang baru dibuat.
        chart.remove();
        chart = undefined;
        return;
      }

      chart.timeScale().fitContent();
      onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth });
      onResize();
      window.addEventListener("resize", onResize);
    })();

    return () => {
      cancelled = true;
      if (chart) {
        if (onResize) window.removeEventListener("resize", onResize);
        chart.remove();
        chart = undefined;
      }
    };
  }, [bars, pattern, tf]);

  // Reset status tiap kali pindah pola.
  useEffect(() => {
    setTargetReached(null);
  }, [pattern?.id]);

  // Deteksi: apakah harga sudah mencapai TARGET KONSERVATIF setelah memantul
  // dari PRZ? Target konservatif = retracement 0.382 dari kaki A→D (titik
  // pantulan). Untuk pola tanpa titik D, titik pantulan diambil dari batas PRZ
  // (prz_low untuk bullish, prz_high untuk bearish). Pola dianggap "sudah
  // mencapai target" bila: (1) harga pernah menyentuh zona PRZ setelah titik C,
  // lalu (2) bergerak menjauh hingga menyentuh target konservatif — meski hanya
  // lewat ekor (wick) candle.
  useEffect(() => {
    if (!pattern || bars.length === 0) return;
    // Peringatan target konservatif hanya berlaku untuk pola completed bullish,
    // bukan pola developing, invalid, maupun completed bearish.
    if (pattern.status !== "completed") return;
    if (pattern.direction === "bearish") return;
    if (pattern.prz_low == null || pattern.prz_high == null || !pattern.c_date) return;
    const cTime = Date.parse(pattern.c_date) / 1000;
    if (Number.isNaN(cTime)) return;
    const after = bars.filter((b) => b.time > cTime);
    if (after.length === 0) return;

    // Cari candle pertama yang menyentuh PRZ (pantulan).
    let przIdx = -1;
    for (let i = 0; i < after.length; i++) {
      const b = after[i];
      const touched =
        pattern.direction === "bullish" ? b.low <= pattern.prz_high! : b.high >= pattern.prz_low!;
      if (touched) {
        przIdx = i;
        break;
      }
    }
    if (przIdx < 0) return;

    const entry =
      pattern.d_price ?? (pattern.direction === "bullish" ? pattern.prz_low : pattern.prz_high);
    const target = entry + 0.382 * (pattern.a_price - entry);
    // Hanya hitung candle SETELAH candle pantulan (bukan candle yang menyentuh
    // PRZ itu sendiri) — candle besar yang sekaligus mencelup ke PRZ dan punya
    // ekor ke arah target jangan dianggap sudah memantul & mencapai target.
    const post = after.slice(przIdx + 1);
    const reached =
      pattern.direction === "bullish"
        ? post.some((b) => b.high >= target)
        : post.some((b) => b.low <= target);
    setTargetReached(reached ? roundToIdxTick(target) : null);
  }, [bars, pattern]);






  // Untuk pola bearish tertentu (Bat, Butterfly, Gartley, Crab): jika harga
  // saat ini sudah naik mendekati/menembus tinggi titik B, tampilkan kartu
  // target price meskipun pola masih developing. Target = PRZ (di atas B).
  const BEARISH_DEV_TARGET_PATTERNS = new Set(["Bat", "Butterfly", "Gartley", "Crab"]);
  const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;
  const showBearishDevTarget =
    !!pattern &&
    pattern.status === "developing" &&
    pattern.direction === "bearish" &&
    BEARISH_DEV_TARGET_PATTERNS.has(pattern.pattern_name) &&
    pattern.prz_low != null &&
    pattern.prz_high != null &&
    lastClose != null &&
    lastClose >= pattern.b_price * 0.70; // harga sudah mendekati tinggi titik B (toleransi 30%)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{symbol} <span className="text-muted-foreground text-base">· {tf}</span></h1>
        </div>
        {pattern && (
          <div className="flex items-center gap-2">
            <Badge variant={pattern.direction === "bullish" ? "default" : "destructive"}>
              {pattern.pattern_name} · {pattern.direction} · {pattern.status} · {Math.round(pattern.confidence * 100)}%
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" aria-label="Hapus pola">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus pola ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Pola {pattern.pattern_name} · {pattern.direction} pada {pattern.symbol} akan
                    dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Menghapus…" : "Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {pattern?.status === "invalid" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Pola ini sudah <span className="font-semibold">tidak valid</span> — harga telah menembus
          titik A (higher high/lower low) atau level invalidation setelah titik C terbentuk.
        </div>
      )}

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex h-[500px] items-center justify-center text-muted-foreground">Loading chart…</div>
          ) : bars.length === 0 ? (
            <div className="flex h-[500px] items-center justify-center text-muted-foreground">No data available for {symbol}.</div>
          ) : (
            <div ref={containerRef} className="w-full" />
          )}
        </CardContent>
      </Card>



      {pattern && (
        <Card className="overflow-hidden">
          <CardHeader>
            {symbol}
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid auto-rows-min grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold  tracking-wider text-primary">
                <span>PRZ — Potential Reversal Zone</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Penjelasan PRZ"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>PRZ — Potential Reversal Zone</DialogTitle>
                    </DialogHeader>
                    <DialogDescription asChild>
                      <p className="text-sm leading-relaxed text-foreground">
                        <strong>PRZ (Potential Reversal Zone)</strong> adalah zona harga di mana
                        pola harmonik diperkirakan selesai dan harga berpotensi berbalik arah.
                        Zona ini dibentuk dari pertemuan beberapa rasio Fibonacci kunci pada
                        kaki C–D. PRZ adalah area paling penting untuk mencari konfirmasi
                        entry: bullish berarti potensi pantulan naik, bearish berarti potensi
                        koreksi turun. Selalu pakai stop-loss di luar level invalidation.
                      </p>
                    </DialogDescription>
                    <DialogFooter>
                      <Button type="button" className="w-full">OK</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {pattern.prz_low != null && pattern.prz_high != null
                  ? `${floorToIdxTick(pattern.prz_low)} – ${ceilToIdxTick(pattern.prz_high)}`
                  : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Zona harga di mana pola berpotensi selesai dan berbalik arah.
              </div>
              {["Crab", "Deep Crab", "Butterfly"].includes(pattern.pattern_name) && (
  <ExtensionWarning patternName={pattern.pattern_name} />
)}
            </div>
            {pattern.status === "completed" && pattern.d_price != null && pattern.direction !== "bearish" && bars.length > 0 && (
              <TargetCard
                current={roundToIdxTick(bars[bars.length - 1].close)}
                target={roundToIdxTick(
                  pattern.d_price + 0.382 * (pattern.a_price - pattern.d_price),
                )}
              />
            )}
            {showBearishDevTarget && lastClose != null && (
              <TargetCard
                current={roundToIdxTick(lastClose)}
                target={floorToIdxTick(pattern.prz_low!)}
                targetHigh={ceilToIdxTick(pattern.prz_high!)}
                title="Target Harga (PRZ)"
              />
            )}
            {pattern.invalidation != null && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-rose-700 dark:text-rose-400">
                  <span>Invalidation</span>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Penjelasan Invalidation"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/30"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground border">
                        <p className="text-xs leading-relaxed">
                          Level harga kritis yang, jika ditembus, membatalkan pola harmonik ini.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="mt-1 text-xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
                  {floorToIdxTick(pattern.invalidation)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Batas kritis — pola tidak valid jika harga ditutup di luar level ini.
                </div>
              </div>
            )}
          </div>

          {pattern.status === "completed" && pattern.d_price != null && bars.length > 0 && targetReached != null && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <div className="flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                <span className="mt-0.5">⚠</span>
                <span>
                  Harga sudah mencapai target konservatif (
                  {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
                    targetReached,
                  )}
                  ) setelah memantul dari PRZ — meski hanya lewat ekor candle. Pertimbangkan
                  untuk menghapus pola ini.
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Hapus pola"
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          <PivotXABCD pattern={pattern} />

        </CardContent>
        </Card>
      )}
    </div>
  );
}
function ExtensionWarning({ patternName }: { patternName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
      >
        <span>⚠ Peringatan pola extension: {patternName}</span>
        <span className="ml-2 text-[10px] opacity-60">{open ? "▲ Tutup" : "▼ Buka"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          <strong>{patternName}</strong> cenderung rawan <em>overshoot</em> di area PRZ. Jika
          ingin masuk posisi, jangan langsung entry saat harga menyentuh zona — tunggu konfirmasi{" "}
          <strong>rejection</strong> terbentuk (mis. candle reversal / pin bar / engulfing) sebelum
          mengambil posisi.
        </div>
      )}
    </div>
  );
}


function TargetCard({
  current,
  target,
  targetHigh,
  title = "Target Harga Konservatif",
}: {
  current: number;
  target: number;
  targetHigh?: number;
  title?: string;
}) {
  const tHigh = targetHigh ?? target;
  const isRange = targetHigh != null && targetHigh !== target;
  const pctLow = current > 0 ? ((target - current) / current) * 100 : 0;
  const pctHigh = current > 0 ? ((tHigh - current) / current) * 100 : 0;
  const up = tHigh >= current;
  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
  const sign = (v: number) => (v >= 0 ? "+" : "");
  return (
    <div className="rounded-xl border-2 border-green-600/40 bg-gradient-to-br from-green-600/15 via-green-600/10 to-transparent p-5 shadow-sm">
      <div className="text-xs font-semibold  tracking-wider text-green-700 dark:text-green-400">
        {title}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Sekarang</span>
          <span className="text-2xl font-bold tracking-tight">{fmt(current)}</span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <span
            className={`text-sm font-bold ${up ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {isRange
              ? `${sign(pctLow)}${pctLow.toFixed(1)}% – ${sign(pctHigh)}${pctHigh.toFixed(1)}%`
              : `${sign(pctLow)}${pctLow.toFixed(1)}%`}
          </span>
          <span className="text-2xl leading-none text-muted-foreground">→</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Target harga</span>
          <span className="text-2xl font-bold tracking-tight text-green-700 dark:text-green-400">
            {isRange ? `${fmt(target)} – ${fmt(tHigh)}` : fmt(target)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PivotCard({
  label,
  date,
  price,
  color,
  pivotLabel = "Pivot",
}: {
  label: string;
  date: string | null;
  price: number | null;
  color: string;
  pivotLabel?: string;
}) {
  const isEmpty = !date || price == null;
  const formatted =
    price != null
      ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(price)
      : null;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${color} ${isEmpty ? "opacity-40" : ""}`}
        >
          {label}
        </span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{pivotLabel}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 font-semibold">
        <span className="text-muted-foreground">{label} :</span>
        {formatted ?? <span className="text-muted-foreground font-normal">pending</span>}
      </div>
      <div className="text-xs text-muted-foreground">
        {date ? new Date(date).toLocaleDateString("id-ID") : "—"}
      </div>
    </div>
  );
}


function PivotRow({
  label,
  date,
  price,
  color,
}: {
  label: string;
  date: string | null;
  price: number | null;
  color: string;
}) {
  const isEmpty = !date || price == null;
  const formatted =
    price != null
      ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(price)
      : null;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color} ${isEmpty ? "opacity-40" : ""}`}
      >
        {label}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-semibold">
          {formatted ?? <span className="text-muted-foreground font-normal">pending</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {date ? new Date(date).toLocaleDateString("id-ID") : "—"}
        </div>
      </div>
    </div>
  );
}


function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function PivotXABCD({ pattern }: { pattern: PatternRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-foreground hover:bg-muted/40 transition-colors"
      >
        <span>{pattern.symbol} Pivot XABCD &amp; Rasio</span>
        <span className="ml-2 text-[10px] opacity-70">{open ? "▲ Tutup" : "▼ Buka"}</span>
      </button>
      {open && (
        <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
            <PivotRow label="X" date={pattern.x_date} price={pattern.x_price} color="bg-fuchsia-500" />
            <PivotRow label="A" date={pattern.a_date} price={pattern.a_price} color="bg-sky-500" />
            <PivotRow label="B" date={pattern.b_date} price={pattern.b_price} color="bg-amber-500" />
            <PivotRow label="C" date={pattern.c_date} price={pattern.c_price} color="bg-emerald-500" />
            <PivotRow label="D" date={pattern.d_date} price={pattern.d_price} color="bg-rose-500" />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
            {pattern.status === "developing" && (
              <Detail label="Progress" value={`${Math.round(pattern.progress_pct ?? 0)}%`} />
            )}

            {pattern.ratios &&
              Object.entries(pattern.ratios).map(([k, v]) => (
                <Detail key={k} label={k} value={Number.isFinite(v) ? v.toFixed(3) : "—"} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

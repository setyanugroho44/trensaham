import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchBarsForSymbol } from "@/lib/scan.functions";
import { floorToIdxTick, ceilToIdxTick, idxTickSize } from "@/lib/harmonic/detect";

function roundToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.round(price / t) * t;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Bar } from "@/lib/harmonic/types";
import harmonicPatternImg from "@/assets/harmonic-pattern.jpg";
import gartleyImg from "@/assets/gartley.png";
import batImg from "@/assets/bat.png";
import butterflyImg from "@/assets/butterfly.png";
import crabImg from "@/assets/crab.png";
import sharkImg from "@/assets/shark.png";
import cypherImg from "@/assets/cypher.png";

const PATTERN_IMAGES: Record<string, string> = {
  Gartley: gartleyImg,
  Bat: batImg,
  Butterfly: butterflyImg,
  Crab: crabImg,
  Shark: sharkImg,
  Cypher: cypherImg,
};

const searchSchema = z.object({
  tf: z.enum(["1d", "1wk", "1mo"]).optional().default("1wk"),
  pid: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/chart/$symbol")({
  validateSearch: searchSchema,
  component: ChartPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.symbol} chart — IDX Harmonic Scanner` }],
  }),
});

type PatternRow = {
  id: string;
  symbol: string;
  pattern_name: string;
  direction: "bullish" | "bearish";
  status: "completed" | "developing";
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
  const fetchBars = useServerFn(fetchBarsForSymbol);

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
      setPattern((pRes as { data: PatternRow | null }).data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [symbol, tf, pid, fetchBars]);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    let chart: any;
    let cleanup = () => {};
    (async () => {
      const lib = await import("lightweight-charts");
      const { createChart, CandlestickSeries, LineSeries, AreaSeries } = lib as any;
      // lightweight-charts can't parse oklch(); resolve theme color to rgb via canvas.
      const isDark = document.documentElement.classList.contains("dark");
      const textColor = isDark ? "#e5e7eb" : "#374151";
      chart = createChart(containerRef.current!, {
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
        if (pattern.x_date && pattern.x_price != null)
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

        // Target konservatif hanya untuk pola completed: retracement 0.382 dari kaki A→D
        if (pattern.status === "completed" && pattern.d_price != null) {
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


      chart.timeScale().fitContent();
      const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth });
      onResize();
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        chart.remove();
      };
    })();
    return () => cleanup();
  }, [bars, pattern, tf]);

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
          <Badge variant={pattern.direction === "bullish" ? "default" : "destructive"}>
            {pattern.pattern_name} · {pattern.direction} · {pattern.status} · {Math.round(pattern.confidence * 100)}%
          </Badge>
        )}
      </div>

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
          <div className="relative h-40 w-full overflow-hidden sm:h-52">
            <img
              src={PATTERN_IMAGES[pattern.pattern_name] ?? harmonicPatternImg}
              alt={`${pattern.pattern_name} harmonic pattern illustration`}
              loading="lazy"
              width={1024}
              height={512}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {pattern.status} · {tf}
                </div>
                <div className="text-xl font-semibold leading-tight">
                  {pattern.pattern_name}{" "}
                  <span className="text-muted-foreground">· {pattern.direction}</span>
                </div>
              </div>
              <Badge variant={pattern.direction === "bullish" ? "default" : "destructive"}>
                {Math.round(pattern.confidence * 100)}%
              </Badge>
            </div>
          </div>

          <CardHeader>
            
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PivotXABCD pattern={pattern} />
              <PivotCard
                label="Now"
                date={bars.length ? new Date(bars[bars.length - 1].time * 1000).toISOString() : null}
                price={bars.length ? bars[bars.length - 1].close : null}
                color="bg-primary"
                pivotLabel="Harga terbaru"
              />
              
            </div>

            <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <span>PRZ — Potential Reversal Zone</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Penjelasan PRZ"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs bg-popover text-popover-foreground border">
                      <p className="text-xs leading-relaxed">
                        <strong>PRZ (Potential Reversal Zone)</strong> adalah zona harga di mana
                        pola harmonik diperkirakan selesai dan harga berpotensi berbalik arah.
                        Zona ini dibentuk dari pertemuan beberapa rasio Fibonacci kunci pada
                        kaki C–D. PRZ adalah area paling penting untuk mencari konfirmasi
                        entry: bullish berarti potensi pantulan naik, bearish berarti potensi
                        koreksi turun. Selalu pakai stop-loss di luar level invalidation.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
            {pattern.status === "completed" && (
              <PivotCard
                label="T"
                date={null}
                price={
                  pattern.d_price != null
                    ? roundToIdxTick(pattern.d_price + 0.382 * (pattern.a_price - pattern.d_price))
                    : null
                }
                color="bg-green-600"
                pivotLabel="Target Harga Konservatif (0.382 AD)"
              />
            )}
            <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-4">
              <Detail label="Invalidation" value={pattern.invalidation?.toFixed(2) ?? "—"} />
              {pattern.status === "developing" && (
                <Detail label="Progress" value={`${Math.round(pattern.progress_pct ?? 0)}%`} />
              )}


              {pattern.ratios &&
                Object.entries(pattern.ratios).map(([k, v]) => (
                  <Detail key={k} label={k} value={Number.isFinite(v) ? v.toFixed(3) : "—"} />
                ))}
            </div>
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
    <div className="rounded-lg border bg-muted/30 sm:col-span-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-300 hover:bg-blue-500/5 transition-colors"
      >
        <span>{pattern.symbol} Pivot XABCD</span>
        <span className="ml-2 text-[10px] opacity-70">{open ? "▲ Tutup" : "▼ Buka"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 pb-3 sm:grid-cols-5">
          <PivotRow label="X" date={pattern.x_date} price={pattern.x_price} color="bg-fuchsia-500" />
          <PivotRow label="A" date={pattern.a_date} price={pattern.a_price} color="bg-sky-500" />
          <PivotRow label="B" date={pattern.b_date} price={pattern.b_price} color="bg-amber-500" />
          <PivotRow label="C" date={pattern.c_date} price={pattern.c_price} color="bg-emerald-500" />
          <PivotRow label="D" date={pattern.d_date} price={pattern.d_price} color="bg-rose-500" />
        </div>
      )}
    </div>
  );
}

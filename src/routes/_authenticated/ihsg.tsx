import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { detectIhsgPatterns, type IhsgPattern } from "@/lib/ihsg.functions";
import { getMyAccess, type AccessInfo } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, Lock, TrendingDown, TrendingUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Bar } from "@/lib/harmonic/types";
import { floorToIdxTick, ceilToIdxTick } from "@/lib/harmonic/detect";

export const Route = createFileRoute("/_authenticated/ihsg")({
  component: IhsgPage,
  head: () => ({ meta: [{ title: "Deteksi Pola Harmonik IHSG — Pro" }] }),
});

type Tf = "1d" | "4h";

const DEFAULTS = {
  timeframe: "1d" as Tf,
  tolerance: 5, // %
  minConfidence: 50, // %
  minBarsSpan: 12,
  minLegPct: 10, // %
  zigzagThreshold: 4, // %
};

function readNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v != null && v !== "") return Number(v);
  } catch { /* ignore */ }
  return fallback;
}

function IhsgPage() {
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const accessFn = useServerFn(getMyAccess);
  const detectFn = useServerFn(detectIhsgPatterns);

  const [timeframe, setTimeframe] = useState<Tf>(() => {
    try {
      const v = localStorage.getItem("ihsg_tf");
      if (v === "1d" || v === "4h") return v;
    } catch { /* ignore */ }
    return DEFAULTS.timeframe;
  });
  const [tolerance, setTolerance] = useState(() => readNum("ihsg_tol", DEFAULTS.tolerance));
  const [minConf, setMinConf] = useState(() => readNum("ihsg_conf", DEFAULTS.minConfidence));
  const [minSpan, setMinSpan] = useState(() => readNum("ihsg_span", DEFAULTS.minBarsSpan));
  const [minLeg, setMinLeg] = useState(() => readNum("ihsg_leg", DEFAULTS.minLegPct));
  const [zigzag, setZigzag] = useState(() => readNum("ihsg_zz", DEFAULTS.zigzagThreshold));

  useEffect(() => { try { localStorage.setItem("ihsg_tf", timeframe); } catch { /* ignore */ } }, [timeframe]);
  useEffect(() => { try { localStorage.setItem("ihsg_tol", String(tolerance)); } catch { /* ignore */ } }, [tolerance]);
  useEffect(() => { try { localStorage.setItem("ihsg_conf", String(minConf)); } catch { /* ignore */ } }, [minConf]);
  useEffect(() => { try { localStorage.setItem("ihsg_span", String(minSpan)); } catch { /* ignore */ } }, [minSpan]);
  useEffect(() => { try { localStorage.setItem("ihsg_leg", String(minLeg)); } catch { /* ignore */ } }, [minLeg]);
  useEffect(() => { try { localStorage.setItem("ihsg_zz", String(zigzag)); } catch { /* ignore */ } }, [zigzag]);

  const [loading, setLoading] = useState(false);
  const [bars, setBars] = useState<Bar[]>([]);
  const [patterns, setPatterns] = useState<IhsgPattern[]>([]);
  const [selected, setSelected] = useState<IhsgPattern | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    accessFn().then(setAccess).catch(() => {});
  }, [accessFn]);

  const resetDefaults = () => {
    setTimeframe(DEFAULTS.timeframe);
    setTolerance(DEFAULTS.tolerance);
    setMinConf(DEFAULTS.minConfidence);
    setMinSpan(DEFAULTS.minBarsSpan);
    setMinLeg(DEFAULTS.minLegPct);
    setZigzag(DEFAULTS.zigzagThreshold);
  };

  const onDetect = async () => {
    setLoading(true);
    try {
      const res = await detectFn({
        data: {
          timeframe,
          tolerance: tolerance / 100,
          minConfidence: minConf / 100,
          minBarsSpan: Math.round(minSpan),
          minLegPct: minLeg / 100,
          zigzagThreshold: zigzag,
        },
      });
      setBars(res.bars);
      setPatterns(res.patterns);
      setSelected(res.patterns[0] ?? null);
      setHasRun(true);
      if ("message" in res && res.message) toast.warning(res.message);
      else toast.success(`Deteksi selesai — ${res.patterns.length} pola ditemukan`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Render chart with selected pattern overlay.
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    let chart: any;
    let cleanup = () => {};
    (async () => {
      const lib = await import("lightweight-charts");
      const { createChart, CandlestickSeries, LineSeries } = lib as any;
      const isDark = document.documentElement.classList.contains("dark");
      chart = createChart(containerRef.current!, {
        height: 460,
        layout: { background: { color: "rgba(0,0,0,0)" }, textColor: isDark ? "#e5e7eb" : "#374151" },
        grid: {
          vertLines: { color: "rgba(120,120,120,0.1)" },
          horzLines: { color: "rgba(120,120,120,0.1)" },
        },
        timeScale: { timeVisible: timeframe !== "1d" },
        rightPriceScale: { borderVisible: false },
      });
      const candle = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });
      candle.setData(bars.map((b) => ({ time: b.time as any, open: b.open, high: b.high, low: b.low, close: b.close })));

      if (selected) {
        const pts: { time: number; price: number; label: string }[] = [];
        const p = selected.points;
        // Pada pola AB=CD kaki X tidak relevan, jadi tidak digambar.
        if (p.X && selected.name !== "AB=CD") pts.push({ time: Date.parse(p.X.date) / 1000, price: p.X.price, label: "X" });
        pts.push({ time: Date.parse(p.A.date) / 1000, price: p.A.price, label: "A" });
        pts.push({ time: Date.parse(p.B.date) / 1000, price: p.B.price, label: "B" });
        pts.push({ time: Date.parse(p.C.date) / 1000, price: p.C.price, label: "C" });
        if (p.D) pts.push({ time: Date.parse(p.D.date) / 1000, price: p.D.price, label: "D" });
        pts.sort((a, b) => a.time - b.time);

        const color = selected.direction === "bullish" ? "#10b981" : "#ef4444";
        const line = chart.addSeries(LineSeries, { color, lineWidth: 2 });
        line.setData(pts.map((pp) => ({ time: pp.time as any, value: pp.price })));
        line.setMarkers(
          pts.map((pp) => ({ time: pp.time as any, position: "inBar" as const, color, shape: "circle" as const, text: pp.label })),
        );

        candle.createPriceLine({ price: selected.prz_high, color: "rgba(168,85,247,0.9)", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: "PRZ High" });
        candle.createPriceLine({ price: selected.prz_low, color: "rgba(168,85,247,0.9)", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: "PRZ Low" });

        if (!p.D) {
          const cTime = Date.parse(p.C.date) / 1000;
          const lastTime = bars[bars.length - 1].time;
          if (cTime < lastTime) {
            const mid = (selected.prz_low + selected.prz_high) / 2;
            const proj = chart.addSeries(LineSeries, { color: "rgba(168,85,247,0.9)", lineWidth: 2, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
            proj.setData([{ time: cTime as any, value: p.C.price }, { time: lastTime as any, value: mid }]);
            proj.setMarkers([{ time: lastTime as any, position: "inBar" as const, color: "rgba(168,85,247,0.9)", shape: "circle" as const, text: "D?" }]);
          }
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
  }, [bars, selected, timeframe]);

  if (access && !access.hasAccess) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" /> Fitur khusus Pro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Deteksi pola harmonik IHSG dengan fine-tuning hanya tersedia untuk member Pro.</p>
            <Button asChild>
              <Link to="/upgrade">Upgrade ke Pro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pola Harmonik IHSG</h1>
          <p className="text-sm text-muted-foreground">
            Deteksi pola harmonik pada Indeks Harga Saham Gabungan (^JKSE) dengan parameter yang bisa Anda atur sendiri.
          </p>
        </div>
        <Button onClick={onDetect} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {loading ? "Mendeteksi…" : "Deteksi Pola"}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Fine Tuning</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetDefaults}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Timeframe</label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Tf)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Daily</SelectItem>
                  <SelectItem value="4h">4 Jam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sensitivitas ZigZag: {zigzag}%</label>
              <Slider value={[zigzag]} min={0.5} max={15} step={0.5} onValueChange={(v) => setZigzag(v[0])} />
              <p className="text-[11px] text-muted-foreground">Makin kecil = makin sensitif (lebih banyak pivot)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Toleransi rasio: {tolerance}%</label>
              <Slider value={[tolerance]} min={1} max={20} step={1} onValueChange={(v) => setTolerance(v[0])} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min confidence: {minConf}%</label>
              <Slider value={[minConf]} min={0} max={100} step={5} onValueChange={(v) => setMinConf(v[0])} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min rentang bar: {minSpan}</label>
              <Slider value={[minSpan]} min={3} max={60} step={1} onValueChange={(v) => setMinSpan(v[0])} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min panjang kaki: {minLeg}%</label>
              <Slider value={[minLeg]} min={1} max={40} step={1} onValueChange={(v) => setMinLeg(v[0])} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          {bars.length === 0 ? (
            <div className="flex h-[460px] items-center justify-center text-center text-sm text-muted-foreground">
              {hasRun ? "Tidak ada data IHSG." : "Atur parameter lalu tekan \"Deteksi Pola\" untuk memuat grafik IHSG."}
            </div>
          ) : (
            <div ref={containerRef} className="w-full" />
          )}
        </CardContent>
      </Card>

      {hasRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pola Terdeteksi ({patterns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada pola dengan parameter ini. Coba longgarkan toleransi, turunkan min confidence, atau ubah sensitivitas ZigZag.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Pattern</th>
                      <th className="px-3 py-2">Dir</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Conf.</th>
                      <th className="px-3 py-2">PRZ</th>
                      <th className="px-3 py-2">Invalidate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.map((p, i) => (
                      <tr
                        key={`${p.name}-${p.direction}-${p.status}-${i}`}
                        className={`cursor-pointer border-t border-border hover:bg-muted/30 ${selected === p ? "bg-muted/40" : ""}`}
                        onClick={() => setSelected(p)}
                      >
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2">
                          {p.direction === "bullish" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600"><TrendingUp className="mr-1 h-3 w-3" /> Bull</Badge>
                          ) : (
                            <Badge className="bg-rose-600 hover:bg-rose-600"><TrendingDown className="mr-1 h-3 w-3" /> Bear</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.status === "developing" ? `developing · ${Math.round(p.progressPct ?? 0)}%` : "completed"}
                        </td>
                        <td className="px-3 py-2 text-xs">{Math.round(p.confidence * 100)}%</td>
                        <td className="px-3 py-2 text-xs">{floorToIdxTick(p.prz_low)} – {ceilToIdxTick(p.prz_high)}</td>
                        <td className="px-3 py-2 text-xs">{floorToIdxTick(p.invalidation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

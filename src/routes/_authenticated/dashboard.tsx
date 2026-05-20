import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runScan } from "@/lib/scan.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, TrendingDown, TrendingUp, X, Info } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — IDX Harmonic Scanner" }] }),
});

type PatternRow = {
  id: string;
  symbol: string;
  timeframe: string;
  pattern_name: string;
  direction: "bullish" | "bearish";
  status: "completed" | "developing";
  confidence: number;
  prz_low: number | null;
  prz_high: number | null;
  invalidation: number | null;
  progress_pct: number | null;
  d_date: string | null;
  created_at: string;
};

const PATTERNS = ["Gartley", "Bat", "Butterfly", "Crab", "Deep Crab", "Shark", "Cypher", "AB=CD"];

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {
    // ignore
  }
}

function DashboardPage() {
  const [timeframe, setTimeframe] = useState<"1d" | "1wk" | "1mo">("1d");
  const [direction, setDirection] = useState<"all" | "bullish" | "bearish">("all");
  const [pattern, setPattern] = useState<string>("all");
  const [minConf, setMinConf] = useState<number>(50);
  const [minProgress, setMinProgress] = useState<number>(7);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<PatternRow[]>([]);
  const scanFn = useServerFn(runScan);

  const load = async () => {
    const { data, error } = await supabase
      .from("patterns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setRows((data as PatternRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const onScan = async () => {
    setScanning(true);
    try {
      const res = await scanFn({ data: { timeframe, minConfidence: minConf / 100 } });
      if ("message" in res && res.message) {
        toast.warning(res.message);
      } else {
        toast.success(`Scan complete — ${res.patternsFound} pattern(s) found`);
        if (res.patternsFound > 0) playBeep();
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const filtered = useMemo(() => {
    const base = rows.filter(
      (r) =>
        r.timeframe === timeframe &&
        (direction === "all" || r.direction === direction) &&
        (pattern === "all" || r.pattern_name === pattern) &&
        r.confidence * 100 >= minConf &&
        (r.status !== "developing" || (r.progress_pct ?? 0) >= minProgress),
    );
    // Dedupe: same symbol + pattern + direction + status + PRZ → keep latest only
    const seen = new Map<string, PatternRow>();
    for (const r of base) {
      const key = `${r.symbol}|${r.pattern_name}|${r.direction}|${r.status}|${r.prz_low?.toFixed(2)}|${r.prz_high?.toFixed(2)}`;
      const cur = seen.get(key);
      if (!cur || new Date(r.created_at).getTime() > new Date(cur.created_at).getTime()) {
        seen.set(key, r);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [rows, direction, pattern, minConf, minProgress, timeframe]);

  const completed = filtered.filter((r) => r.status === "completed");
  const developing = filtered.filter((r) => r.status === "developing");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scanner Dashboard</h1>
          <p className="text-sm text-muted-foreground">Detect harmonic patterns across your IDX watchlist.</p>
        </div>
        <Button onClick={onScan} disabled={scanning}>
          {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {scanning ? "Scanning…" : "Scan Now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Timeframe</label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Daily</SelectItem>
                  <SelectItem value="1wk">Weekly</SelectItem>
                  <SelectItem value="1mo">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Direction</label>
              <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="bullish">Bullish</SelectItem>
                  <SelectItem value="bearish">Bearish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pattern</label>
              <Select value={pattern} onValueChange={setPattern}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PATTERNS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min confidence: {minConf}%</label>
              <Slider value={[minConf]} min={0} max={100} step={5} onValueChange={(v) => setMinConf(v[0])} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min progress: {minProgress}%</label>
              <Slider value={[minProgress]} min={0} max={100} step={5} onValueChange={(v) => setMinProgress(v[0])} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="developing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="developing">Developing ({developing.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="developing">
          <PatternsTable rows={developing} kind="developing" timeframe={timeframe} onDeleted={load} />
        </TabsContent>
        <TabsContent value="completed">
          <PatternsTable rows={completed} kind="completed" timeframe={timeframe} onDeleted={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatternsTable({
  rows,
  kind,
  timeframe,
  onDeleted,
}: {
  rows: PatternRow[];
  kind: "completed" | "developing";
  timeframe: string;
  onDeleted: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<PatternRow | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("patterns").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pattern deleted");
      onDeleted();
    }
    setPendingDelete(null);
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No {kind} patterns. Try running a scan or adjusting filters.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Symbol</th>
            <th className="px-3 py-2">Pattern</th>
            <th className="px-3 py-2">Dir</th>
            <th className="px-3 py-2">Conf.</th>
            <th className="px-3 py-2">PRZ</th>
            <th className="px-3 py-2">{kind === "developing" ? "Progress" : "D Date"}</th>
            <th className="px-3 py-2">Invalidate</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">
                <Link
                  to="/chart/$symbol"
                  params={{ symbol: r.symbol }}
                  search={{ tf: timeframe, pid: r.id }}
                  className="text-primary hover:underline"
                >
                  {r.symbol}
                </Link>
              </td>
              <td className="px-3 py-2">{r.pattern_name}</td>
              <td className="px-3 py-2">
                {r.direction === "bullish" ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">
                    <TrendingUp className="mr-1 h-3 w-3" /> Bull
                  </Badge>
                ) : (
                  <Badge className="bg-rose-600 hover:bg-rose-600">
                    <TrendingDown className="mr-1 h-3 w-3" /> Bear
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.round(r.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(r.confidence * 100)}%</span>
                </div>
              </td>
              <td className="px-3 py-2 text-xs">
                {r.prz_low != null && r.prz_high != null
                  ? `${r.prz_low.toFixed(2)} – ${r.prz_high.toFixed(2)}`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-xs">
                {kind === "developing"
                  ? `${Math.round(r.progress_pct ?? 0)}%`
                  : r.d_date
                    ? new Date(r.d_date).toLocaleDateString()
                    : "—"}
              </td>
              <td className="px-3 py-2 text-xs">{r.invalidation?.toFixed(2) ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => setPendingDelete(r)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  aria-label="Delete pattern"
                >
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pattern ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `${pendingDelete.symbol} • ${pendingDelete.pattern_name} (${pendingDelete.direction}) akan dihapus permanen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

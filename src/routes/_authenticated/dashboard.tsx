import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runScan, reevaluatePatternsBatch } from "@/lib/scan.functions";
import { getMyAccess, type AccessInfo } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Play, TrendingDown, TrendingUp, X, Info, Lock, Settings2, ArrowUp, ArrowDown } from "lucide-react";
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
import { floorToIdxTick, ceilToIdxTick } from "@/lib/harmonic/detect";

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
  status: "completed" | "developing" | "invalid";
  confidence: number;
  prz_low: number | null;
  prz_high: number | null;
  invalidation: number | null;
  progress_pct: number | null;
  d_date: string | null;
  created_at: string;
};



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
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<"1d" | "1wk" | "1mo">(() => {
    try {
      const v = localStorage.getItem("dashboard_tf");
      if (v === "1d" || v === "1wk" || v === "1mo") return v;
    } catch { /* ignore */ }
    return "1d";
  });
  const [minConf, setMinConf] = useState<number>(() => {
    try {
      const v = localStorage.getItem("dashboard_minConf");
      if (v) return Math.max(0, Math.min(100, Number(v) || 50));
    } catch { /* ignore */ }
    return 50;
  });
  const [minProgress, setMinProgress] = useState<number>(() => {
    try {
      const v = localStorage.getItem("dashboard_minProgress");
      if (v) return Math.max(0, Math.min(100, Number(v) || 20));
    } catch { /* ignore */ }
    return 20;
  });

  useEffect(() => {
    try { localStorage.setItem("dashboard_tf", timeframe); } catch { /* ignore */ }
  }, [timeframe]);
  useEffect(() => {
    try { localStorage.setItem("dashboard_minConf", String(minConf)); } catch { /* ignore */ }
  }, [minConf]);
  useEffect(() => {
    try { localStorage.setItem("dashboard_minProgress", String(minProgress)); } catch { /* ignore */ }
  }, [minProgress]);

  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const scanFn = useServerFn(runScan);
  const reevaluateBatchFn = useServerFn(reevaluatePatternsBatch);
  const accessFn = useServerFn(getMyAccess);
  const watchlistToastShown = useRef(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("patterns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setRows((data as PatternRow[]) ?? []);
  };

  // Evaluasi ulang status pola untuk timeframe aktif lalu muat ulang, agar tab
  // Developing/Completed mencerminkan status terkini (bukan status scan lama).
  const reevaluateAndLoad = async () => {
    try {
      await reevaluateBatchFn({ data: { timeframe } });
    } catch { /* ignore — tetap tampilkan data tersimpan */ }
    await load();
  };

  const loadWatchlistCount = async () => {
    const { count, error } = await supabase
      .from("watchlist_symbols")
      .select("*", { count: "exact", head: true });
    if (!error) setWatchlistCount(count ?? 0);
  };

  useEffect(() => {
    loadWatchlistCount();
    accessFn().then(setAccess).catch(() => {});
  }, []);

  // Re-evaluasi setiap kali timeframe berubah (termasuk saat pertama dibuka).
  useEffect(() => {
    reevaluateAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  useEffect(() => {
    if (watchlistCount === 0 && !watchlistToastShown.current) {
      watchlistToastShown.current = true;
      toast.warning("Watchlist kosong. Anda perlu menambahkan saham agar scanner dapat bekerja.", {
        action: {
          label: "Tambah Sekarang",
          onClick: () => navigate({ to: "/watchlist" }),
        },
      });
    }
  }, [watchlistCount, navigate]);

  const onScan = async () => {
    setScanning(true);
    try {
      const res = await scanFn({ data: { timeframe, minConfidence: minConf / 100 } });
      if ("message" in res && res.message) {
        toast.warning(res.message);
      } else {
        const invalidated = "patternsInvalidated" in res ? (res.patternsInvalidated ?? 0) : 0;
        toast.success(
          `Scan selesai — ${res.patternsFound} pola ditemukan` +
            (invalidated > 0 ? `, ${invalidated} pola lama jadi tidak valid` : ""),
        );
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
        r.status !== "invalid" &&
        r.confidence * 100 >= minConf &&
        (r.status !== "developing" || (r.progress_pct ?? 0) >= minProgress) &&
        // Abaikan pola dengan PRZ di bawah 60
        !(r.prz_high != null && r.prz_high < 60),
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
    return Array.from(seen.values()).sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.progress_pct ?? 0) - (a.progress_pct ?? 0);
    });
  }, [rows, minConf, minProgress, timeframe]);

  const completed = filtered.filter((r) => r.status === "completed");
  const developing = filtered.filter((r) => r.status === "developing");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scanner Dashboard</h1>
          <p className="text-sm text-muted-foreground">Deteksi Pola Harmonik di Watchlistmu Dengan Mudah.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <SettingsDialog
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              minConf={minConf}
              setMinConf={setMinConf}
              minProgress={minProgress}
              setMinProgress={setMinProgress}
            />
            <Button onClick={onScan} disabled={scanning || (access ? !access.hasAccess : false)}>
              {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : access && !access.hasAccess ? <Lock className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {scanning ? "Scanning…" : "Scan Now"}
            </Button>
          </div>
          {access && !access.hasAccess && (
            <p className="text-xs text-destructive">
              Masa aktif Anda berakhir.{" "}
              <Link to="/upgrade" className="font-semibold underline">Upgrade ke Pro</Link>{" "}
              agar scanner kembali berjalan.
            </p>
          )}
          {access?.reason === "trial" && access.trialEndsAt && (
            <p className="text-xs text-muted-foreground">
              Trial berakhir {new Date(access.trialEndsAt).toLocaleDateString("id-ID")}
            </p>
          )}
          {access?.reason === "pro" && access.proEndsAt && (
            <p className="text-xs text-muted-foreground">
               aktif hingga {new Date(access.proEndsAt).toLocaleDateString("id-ID")}
            </p>
          )}
        </div>
      </div>

      {watchlistCount === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Watchlist kosong</AlertTitle>
          <AlertDescription>
            Anda belum memiliki saham di watchlist.{" "}
            <Link to="/watchlist" className="font-medium underline">
              Tambahkan simbol saham
            </Link>{" "}
            agar scanner dapat bekerja.
          </AlertDescription>
        </Alert>
      )}



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

function SettingsDialog({
  timeframe,
  setTimeframe,
  minConf,
  setMinConf,
  minProgress,
  setMinProgress,
}: {
  timeframe: "1d" | "1wk" | "1mo";
  setTimeframe: (v: "1d" | "1wk" | "1mo") => void;
  minConf: number;
  setMinConf: (v: number) => void;
  minProgress: number;
  setMinProgress: (v: number) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Pengaturan">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan & Fine Tuning</DialogTitle>
          <DialogDescription>
            Atur parameter scanner agar hasil deteksi pola sesuai dengan gaya trading Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Timeframe</label>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Daily</SelectItem>
                <SelectItem value="1wk">Weekly</SelectItem>
                <SelectItem value="1mo">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Rentang waktu tiap candle. Daily untuk swing/harian, Weekly &amp; Monthly untuk tren jangka panjang.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Min confidence: {minConf}%</label>
            <Slider value={[minConf]} min={0} max={100} step={5} onValueChange={(v) => setMinConf(v[0])} />
            <p className="text-xs text-muted-foreground">
              Ambang minimum tingkat keyakinan pola. Semakin tinggi, semakin sedikit hasil tapi kualitas pola lebih akurat.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Min progress: {minProgress}%</label>
            <Slider value={[minProgress]} min={0} max={100} step={5} onValueChange={(v) => setMinProgress(v[0])} />
            <p className="text-xs text-muted-foreground">
              Khusus pola yang masih berkembang (developing). Menyaring pola yang baru terbentuk; nilai lebih tinggi hanya menampilkan pola yang hampir lengkap.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>OK</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<PatternRow | null>(null);
  const [sort, setSort] = useState<
    { field: "symbol" | "progress" | "confidence"; dir: "asc" | "desc" } | null
  >(null);

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

  const toggleSort = (field: "symbol" | "progress" | "confidence") => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return null;
    });
  };

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort.field === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sort.field === "confidence") {
        cmp = a.confidence - b.confidence;
      } else if (sort.field === "progress") {
        if (kind === "developing") {
          cmp = (a.progress_pct ?? 0) - (b.progress_pct ?? 0);
        } else {
          cmp =
            new Date(a.d_date ?? 0).getTime() -
            new Date(b.d_date ?? 0).getTime();
        }
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, kind]);

  const SortIcon = ({ field }: { field: "symbol" | "progress" | "confidence" }) => {
    if (!sort || sort.field !== field) return <span className="inline-block w-3" />;
    return sort.dir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Tidak ditemukan pola {kind}. Tekan tombol scan, rubah filter atau tambah kode saham di watchlist.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("symbol")}>
              Saham <SortIcon field="symbol" />
            </th>
            <th className="px-3 py-2">Pattern</th>
            <th className="px-3 py-2">Dir</th>
            <th className="px-3 py-2 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("progress")}>
              {kind === "developing" ? <>Progress <SortIcon field="progress" /></> : <>D Date <SortIcon field="progress" /></>}
            </th>
            <th className="px-3 py-2 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("confidence")}>
              Conf. <SortIcon field="confidence" />
            </th>
            <th className="px-3 py-2">PRZ</th>
            <th className="px-3 py-2">Invalidate</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="border-t border-border hover:bg-muted/30 cursor-pointer"
              onClick={() =>
                navigate({
                  to: "/chart/$symbol",
                  params: { symbol: r.symbol },
                  search: { tf: timeframe, pid: r.id },
                })
              }
            >
              <td className="px-3 py-2 font-medium">{r.symbol}</td>
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
              <td className="px-3 py-2 text-xs">
                {kind === "developing"
                  ? `${Math.round(r.progress_pct ?? 0)}%`
                  : r.d_date
                    ? new Date(r.d_date).toLocaleDateString()
                    : "—"}
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
                  ? `${floorToIdxTick(r.prz_low)} – ${ceilToIdxTick(r.prz_high)}`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-xs">{r.invalidation != null ? floorToIdxTick(r.invalidation) : "—"}</td>

              <td className="px-3 py-2 text-right">
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(r); }}
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

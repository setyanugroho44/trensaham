import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooBars, type Timeframe } from "./yahoo.server";
import { zigzag } from "./harmonic/zigzag";
import { detectPatterns } from "./harmonic/detect";

const TF = z.enum(["1d", "1wk", "1mo"]);

/**
 * Evaluasi ulang pola yang sudah terdeteksi sebelumnya.
 * Pola dianggap TIDAK VALID jika, setelah titik C terbentuk, harga:
 *  - bullish: membentuk higher high yang melewati titik A, atau menembus
 *    level invalidation (turun di bawahnya);
 *  - bearish: membentuk lower low yang melewati titik A, atau menembus
 *    level invalidation (naik di atasnya).
 */
function isPatternInvalidated(
  bars: { time: number; high: number; low: number }[],
  p: { direction: string; a_price: number | null; c_date: string | null; invalidation: number | null },
): boolean {
  if (!p.c_date) return false;
  const cTime = Math.floor(Date.parse(p.c_date) / 1000);
  if (Number.isNaN(cTime)) return false;
  const after = bars.filter((b) => b.time > cTime);
  if (after.length === 0) return false;
  const maxHigh = Math.max(...after.map((b) => b.high));
  const minLow = Math.min(...after.map((b) => b.low));
  if (p.direction === "bullish") {
    if (p.a_price != null && maxHigh > p.a_price) return true; // higher high melewati A
    if (p.invalidation != null && minLow < p.invalidation) return true; // tembus invalidation
  } else {
    if (p.a_price != null && minLow < p.a_price) return true; // lower low melewati A
    if (p.invalidation != null && maxHigh > p.invalidation) return true; // tembus invalidation
  }
  return false;
}

async function assertScanAccess(
  supabase: {
    rpc: (
      fn: "has_active_access",
      args: { _user_id: string },
    ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_active_access", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Akun Anda tidak aktif. Upgrade ke Pro agar scanner bisa dijalankan kembali.");
  }
}

export const fetchBarsForSymbol = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string; timeframe: Timeframe }) =>
    z.object({ symbol: z.string().min(1).max(20), timeframe: TF }).parse(d),
  )
  .handler(async ({ data }) => {
    const bars = await fetchYahooBars(data.symbol, data.timeframe);
    return { bars };
  });

export const runScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { timeframe: Timeframe; tolerance?: number; minConfidence?: number }) =>
    z
      .object({
        timeframe: TF,
        tolerance: z.number().min(0.01).max(0.2).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertScanAccess(supabase, userId);

    // load watchlist
    const { data: wl, error: wlErr } = await supabase.from("watchlist_symbols").select("symbol");
    if (wlErr) throw new Error(wlErr.message);
    const symbols = (wl ?? []).map((r) => r.symbol);
    if (symbols.length === 0) {
      return { patternsFound: 0, runId: null, message: "Watchlist is empty" };
    }

    // create scan_run
    const { data: run, error: runErr } = await supabase
      .from("scan_runs")
      .insert({
        user_id: userId,
        timeframe: data.timeframe,
        symbols_total: symbols.length,
        status: "running",
      })
      .select()
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "Failed to create scan run");

    let totalFound = 0;
    let totalInvalidated = 0;
    let done = 0;
    const errors: string[] = [];

    for (const symbol of symbols) {
      try {
        const bars = await fetchYahooBars(symbol, data.timeframe);
        if (bars.length < 30) {
          done++;
          continue;
        }
        // Multi-scale zigzag thresholds disesuaikan per timeframe agar
        // pivot mewakili swing yang signifikan & pola merentang banyak candle.
        // Scale lebih banyak untuk menangkap pola di berbagai level.
        // Daily disesuaikan khusus untuk meningkatkan deteksi pattern intraday.
        const scales =
          data.timeframe === "1mo" ? [15, 25, 50] : data.timeframe === "1wk" ? [10, 15, 24] : [3, 5, 8, 12];
        // Minimum bar-span X→C agar pola tidak terlalu sempit di sumbu waktu.
        // Dikurangi untuk menangkap pola yang lebih kecil.
        // Daily lebih agresif untuk meningkatkan deteksi.
        const minBarsSpan = data.timeframe === "1mo" ? 6 : data.timeframe === "1wk" ? 12 : 15;
        // Minimum panjang kaki XA (% terhadap harga X) agar pola tidak sempit di sumbu harga.
        // Dikurangi untuk menangkap pola dengan amplitude lebih kecil.
        // Daily lebih agresif untuk intraday moves.
        
        // (masih di atas noise harian biasa, sesuai praktik harmonic scanner).
        const minLegPct = data.timeframe === "1mo" ? 0.20 : data.timeframe === "1wk" ? 0.15 : 0.08;
        const allPatterns = scales.flatMap((th) => {
          const pivots = zigzag(bars, th);
          return detectPatterns(pivots, bars, {
            // Daily tolerance dilonggarkan 0.03 → 0.05 (masih dalam rentang umum
            // ±5% yang dipakai banyak harmonic scanner) supaya rasio "titik"
            // seperti Gartley AB=0.618 / AD=0.786 dan Bat AD=0.886 tidak terlalu
            // sering gagal validasi.
            tolerance: data.tolerance ?? (data.timeframe === "1d" ? 0.05 : 0.04),
            minConfidence: data.minConfidence ?? (data.timeframe === "1d" ? 0.25 : 0.3),
            minBarsSpan,
            minLegPct,
          });
        });
        // dedupe by pattern+direction+status, keep highest confidence
        const dedupMap = new Map<string, (typeof allPatterns)[number]>();
        for (const p of allPatterns) {
          const key = `${p.name}-${p.direction}-${p.status}`;
          const cur = dedupMap.get(key);
          if (!cur || p.confidence > cur.confidence) dedupMap.set(key, p);
        }
        const patterns = Array.from(dedupMap.values());

        if (patterns.length > 0) {
          const rows = patterns.map((p) => ({
            user_id: userId,
            scan_run_id: run.id,
            symbol,
            timeframe: data.timeframe,
            pattern_name: p.name,
            direction: p.direction,
            status: p.status,
            confidence: Number(p.confidence.toFixed(4)),
            x_date: p.X ? new Date(p.X.time * 1000).toISOString() : null,
            x_price: p.X?.price ?? null,
            a_date: new Date(p.A.time * 1000).toISOString(),
            a_price: p.A.price,
            b_date: new Date(p.B.time * 1000).toISOString(),
            b_price: p.B.price,
            c_date: new Date(p.C.time * 1000).toISOString(),
            c_price: p.C.price,
            d_date: p.D ? new Date(p.D.time * 1000).toISOString() : null,
            d_price: p.D?.price ?? null,
            prz_low: p.prz.low,
            prz_high: p.prz.high,
            invalidation: p.invalidation,
            progress_pct: p.progressPct ?? null,
            ratios: p.ratios,
          }));
          const { error: insErr } = await supabase.from("patterns").insert(rows);
          if (insErr) errors.push(`${symbol}: ${insErr.message}`);
          else totalFound += rows.length;
        }
      } catch (e) {
        errors.push(`${symbol}: ${(e as Error).message}`);
      }
      done++;
    }

    await supabaseAdmin
      .from("scan_runs")
      .update({
        status: errors.length === symbols.length ? "failed" : "completed",
        symbols_done: done,
        patterns_found: totalFound,
        finished_at: new Date().toISOString(),
        error: errors.length ? errors.slice(0, 5).join("; ") : null,
      })
      .eq("id", run.id);

    return { runId: run.id, patternsFound: totalFound, errors };
  });

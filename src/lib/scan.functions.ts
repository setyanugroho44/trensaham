import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooBars, type Timeframe } from "./yahoo.server";
import { zigzag } from "./harmonic/zigzag";
import { detectPatterns } from "./harmonic/detect";

const TF = z.enum(["1d", "1wk", "1mo"]);

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
        // Dinaikkan agar pola besar lebih sering muncul, pola sempit terfilter.
        const scales =
          data.timeframe === "1mo" ? [25, 50] : data.timeframe === "1wk" ? [15, 24] : [8, 14];
        // Minimum bar-span X→C agar pola tidak terlalu sempit di sumbu waktu.
        const minBarsSpan = data.timeframe === "1mo" ? 8 : data.timeframe === "1wk" ? 16 : 25;
        // Minimum panjang kaki XA (% terhadap harga X) agar pola tidak sempit di sumbu harga.
        const minLegPct = data.timeframe === "1mo" ? 0.25 : data.timeframe === "1wk" ? 0.18 : 0.12;
        const allPatterns = scales.flatMap((th) => {
          const pivots = zigzag(bars, th);
          return detectPatterns(pivots, bars, {
            tolerance: data.tolerance ?? 0.05,
            minConfidence: data.minConfidence ?? 0.4,
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

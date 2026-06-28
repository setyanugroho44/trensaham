import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooBars, type Timeframe } from "./yahoo.server";
import { zigzag } from "./harmonic/zigzag";
import { detectPatterns } from "./harmonic/detect";

const TF = z.enum(["1h", "1d", "1wk", "1mo"]);


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

/**
 * Evaluasi ulang status sebuah pola tersimpan berdasarkan data harga terbaru.
 *
 * Tujuan: status pola tidak lagi "macet" di developing setelah harga benar-benar
 * memantul dari PRZ. Saat halaman chart dibuka, status dihitung ulang:
 *
 *  - "invalid"   : harga close menembus level invalidation, ATAU membentuk
 *                  higher high (bullish) / lower low (bearish) yang melewati A.
 *  - "completed" : harga sudah masuk zona PRZ (low<=prz_high untuk bullish,
 *                  high>=prz_low untuk bearish) lalu MEMANTUL keluar zona
 *                  (ada candle close di sisi berlawanan PRZ). Titik D diisi
 *                  dari ekstrem swing di dalam zona.
 *  - "developing": selain kondisi di atas (harga belum mencapai/memantul).
 */
function reevaluateStatus(
  bars: { time: number; high: number; low: number; close: number }[],
  p: {
    direction: string;
    a_price: number | null;
    c_date: string | null;
    prz_low: number | null;
    prz_high: number | null;
    invalidation: number | null;
    status: string;
  },
): { status: "developing" | "completed" | "invalid"; d_time?: number; d_price?: number } {
  if (!p.c_date) return { status: p.status as "developing" | "completed" | "invalid" };
  const cTime = Math.floor(Date.parse(p.c_date) / 1000);
  if (Number.isNaN(cTime)) return { status: p.status as "developing" | "completed" | "invalid" };
  const after = bars.filter((b) => b.time > cTime);
  if (after.length === 0) return { status: "developing" };

  const maxHigh = Math.max(...after.map((b) => b.high));
  const minLow = Math.min(...after.map((b) => b.low));

  // --- Invalidation (paling diutamakan) ---
  if (p.direction === "bullish") {
    if (p.invalidation != null && after.some((b) => b.close < p.invalidation!)) return { status: "invalid" };
    if (p.a_price != null && maxHigh > p.a_price) return { status: "invalid" };
  } else {
    if (p.invalidation != null && after.some((b) => b.close > p.invalidation!)) return { status: "invalid" };
    if (p.a_price != null && minLow < p.a_price) return { status: "invalid" };
  }

  // --- Completed: masuk PRZ lalu memantul keluar ---
  if (p.prz_low != null && p.prz_high != null) {
    if (p.direction === "bullish") {
      const enteredIdx = after.findIndex((b) => b.low <= p.prz_high!);
      if (enteredIdx >= 0) {
        const post = after.slice(enteredIdx);
        let dBar = post[0];
        for (const b of post) if (b.low < dBar.low) dBar = b;
        const dPos = enteredIdx + post.indexOf(dBar);
        const bounced = after.slice(dPos + 1).some((b) => b.close > p.prz_high!);
        if (bounced) return { status: "completed", d_time: dBar.time, d_price: dBar.low };
      }
    } else {
      const enteredIdx = after.findIndex((b) => b.high >= p.prz_low!);
      if (enteredIdx >= 0) {
        const post = after.slice(enteredIdx);
        let dBar = post[0];
        for (const b of post) if (b.high > dBar.high) dBar = b;
        const dPos = enteredIdx + post.indexOf(dBar);
        const bounced = after.slice(dPos + 1).some((b) => b.close < p.prz_low!);
        if (bounced) return { status: "completed", d_time: dBar.time, d_price: dBar.high };
      }
    }
  }

  return { status: "developing" };
}

/**
 * Hitung ulang status satu pola (dipakai halaman chart saat dibuka) dan simpan
 * perubahannya. Mengembalikan status terbaru beserta titik D bila pola sudah
 * "completed".
 */
export const reevaluatePattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patternId: string }) =>
    z.object({ patternId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await supabase
      .from("patterns")
      .select("id, symbol, timeframe, direction, a_price, c_date, prz_low, prz_high, invalidation, status, d_date, d_price")
      .eq("id", data.patternId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return { status: null as null | string, changed: false };

    let bars: { time: number; high: number; low: number; close: number }[];
    try {
      bars = await fetchYahooBars(p.symbol, p.timeframe as Timeframe);
    } catch {
      return { status: p.status, changed: false };
    }
    if (bars.length === 0) return { status: p.status, changed: false };

    const result = reevaluateStatus(bars, p);
    const changed =
      result.status !== p.status ||
      (result.status === "completed" && result.d_price != null && p.d_price == null);
    if (changed) {
      const update: { status: string; d_date?: string; d_price?: number } = { status: result.status };
      if (result.status === "completed" && result.d_time != null && result.d_price != null) {
        update.d_date = new Date(result.d_time * 1000).toISOString();
        update.d_price = result.d_price;
      }
      await supabaseAdmin.from("patterns").update(update).eq("id", p.id);
    }
    return {
      status: result.status,
      changed,
      d_date: result.d_time != null ? new Date(result.d_time * 1000).toISOString() : p.d_date,
      d_price: result.d_price ?? p.d_price,
    };
  });

/**
 * Evaluasi ulang status SEMUA pola (developing & completed) untuk satu timeframe.
 *
 * Dipakai halaman dashboard saat dibuka agar tab Developing/Completed selalu
 * mencerminkan status terbaru — bukan status lama dari hasil scan terakhir.
 * Bars di-fetch sekali per simbol agar efisien.
 */
export const reevaluatePatternsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { timeframe: Timeframe }) => z.object({ timeframe: TF }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("patterns")
      .select("id, symbol, timeframe, direction, a_price, c_date, prz_low, prz_high, invalidation, status, d_price")
      .eq("timeframe", data.timeframe)
      .in("status", ["developing", "completed"]);
    if (error) throw new Error(error.message);
    const patterns = rows ?? [];
    if (patterns.length === 0) return { changed: 0 };

    // Kelompokkan per simbol agar bars cukup di-fetch sekali per saham.
    const bySymbol = new Map<string, typeof patterns>();
    for (const p of patterns) {
      const arr = bySymbol.get(p.symbol) ?? [];
      arr.push(p);
      bySymbol.set(p.symbol, arr);
    }

    let changedCount = 0;
    for (const [symbol, ps] of bySymbol) {
      let bars: { time: number; high: number; low: number; close: number }[];
      try {
        bars = await fetchYahooBars(symbol, data.timeframe);
      } catch {
        continue;
      }
      if (bars.length === 0) continue;
      for (const p of ps) {
        const result = reevaluateStatus(bars, p);
        const changed =
          result.status !== p.status ||
          (result.status === "completed" && result.d_price != null && p.d_price == null);
        if (!changed) continue;
        const update: { status: string; d_date?: string; d_price?: number } = { status: result.status };
        if (result.status === "completed" && result.d_time != null && result.d_price != null) {
          update.d_date = new Date(result.d_time * 1000).toISOString();
          update.d_price = result.d_price;
        }
        const { error: upErr } = await supabaseAdmin.from("patterns").update(update).eq("id", p.id);
        if (!upErr) changedCount += 1;
      }
    }

    return { changed: changedCount };
  });

/**
 * Cari pola "developing" yang sudah pernah menyentuh target PRZ — meski hanya
 * lewat wick (ekor candle) — pada candle setelah titik C terbentuk.
 *
 * - Bullish : PRZ berada di bawah C, harga turun ke zona. Tersentuh bila ada
 *   candle dengan low <= prz_high (ekor masuk ke zona).
 * - Bearish : PRZ berada di atas C, harga naik ke zona. Tersentuh bila ada
 *   candle dengan high >= prz_low.
 *
 * Pola seperti ini secara teknis sudah "mencapai target", jadi dikembalikan ke
 * UI agar user bisa diminta konfirmasi apakah ingin menghapusnya.
 */
export const findTargetReachedDeveloping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { timeframe: Timeframe }) => z.object({ timeframe: TF }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("patterns")
      .select("id, symbol, pattern_name, direction, prz_low, prz_high, c_date")
      .eq("timeframe", data.timeframe)
      .eq("status", "developing");
    if (error) throw new Error(error.message);
    const patterns = rows ?? [];
    if (patterns.length === 0) return { hits: [] };

    // Kelompokkan per simbol agar bars cukup di-fetch sekali per saham.
    const bySymbol = new Map<string, typeof patterns>();
    for (const p of patterns) {
      const arr = bySymbol.get(p.symbol) ?? [];
      arr.push(p);
      bySymbol.set(p.symbol, arr);
    }

    const hits: {
      id: string;
      symbol: string;
      pattern_name: string;
      direction: string;
      prz_low: number | null;
      prz_high: number | null;
    }[] = [];

    for (const [symbol, ps] of bySymbol) {
      let bars: { time: number; high: number; low: number }[];
      try {
        bars = await fetchYahooBars(symbol, data.timeframe);
      } catch {
        continue;
      }
      for (const p of ps) {
        if (p.prz_low == null || p.prz_high == null || !p.c_date) continue;
        const cTime = Math.floor(Date.parse(p.c_date) / 1000);
        if (Number.isNaN(cTime)) continue;
        const after = bars.filter((b) => b.time > cTime);
        if (after.length === 0) continue;
        const reached =
          p.direction === "bullish"
            ? after.some((b) => b.low <= p.prz_high!)
            : after.some((b) => b.high >= p.prz_low!);
        if (reached) {
          hits.push({
            id: p.id,
            symbol,
            pattern_name: p.pattern_name,
            direction: p.direction,
            prz_low: p.prz_low,
            prz_high: p.prz_high,
          });
        }
      }
    }

    return { hits };
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
    const watchlist = (wl ?? []).map((r) => r.symbol);
    if (watchlist.length === 0) {
      return { patternsFound: 0, runId: null, message: "Watchlist is empty" };
    }

    // Bonus: IHSG (^JKSE) selalu ikut dipindai bersama watchlist mengikuti
    // aturan scanner utama (timeframe, toleransi, dsb yang sama).
    const IHSG_TICKER = "^JKSE";
    const symbols = watchlist.includes(IHSG_TICKER) ? watchlist : [...watchlist, IHSG_TICKER];

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

        // Evaluasi ulang pola lama untuk simbol+timeframe ini: cek invalid
        // (higher high/lower low melewati A, atau tembus invalidation) dan
        // sekaligus cek apakah pola "developing" sudah "completed" (sudah
        // masuk PRZ lalu memantul keluar zona).
        const { data: existing } = await supabase
          .from("patterns")
          .select("id, direction, a_price, c_date, invalidation, prz_low, prz_high, status, d_price")
          .eq("symbol", symbol)
          .eq("timeframe", data.timeframe)
          .in("status", ["developing", "completed"]);

        for (const p of existing ?? []) {
          const result = reevaluateStatus(bars, p);
          const changed =
            result.status !== p.status ||
            (result.status === "completed" && result.d_price != null && p.d_price == null);
          if (!changed) continue;

          const update: { status: string; d_date?: string; d_price?: number } = { status: result.status };
          if (result.status === "completed" && result.d_time != null && result.d_price != null) {
            update.d_date = new Date(result.d_time * 1000).toISOString();
            update.d_price = result.d_price;
          }
          const { error: upErr } = await supabaseAdmin
            .from("patterns")
            .update(update)
            .eq("id", p.id);
          if (!upErr && result.status === "invalid") totalInvalidated += 1;
        }

        // Multi-scale zigzag thresholds disesuaikan per timeframe agar
        // pivot mewakili swing yang signifikan & pola merentang banyak candle.
        // Scale lebih banyak untuk menangkap pola di berbagai level.
        // Daily disesuaikan khusus untuk meningkatkan deteksi pattern intraday.
        const scales =
          data.timeframe === "1mo" ? [45, 65, 85] : data.timeframe === "1wk" ? [20, 27, 37, 43] : [ 5, 10, 14, 18];
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
          const rows = patterns
            .map((p) => {
              const cIso = new Date(p.C.time * 1000).toISOString();
              // Evaluasi status terhadap pergerakan harga SETELAH titik C, sama
              // seperti yang dilakukan dashboard saat refresh (reevaluatePatternsBatch).
              // Tanpa ini, pola yang sebenarnya sudah invalid/completed tetap
              // tersimpan sebagai "developing" lalu hilang saat halaman direfresh.
              const re = reevaluateStatus(bars, {
                direction: p.direction,
                a_price: p.A.price,
                c_date: cIso,
                prz_low: p.prz.low,
                prz_high: p.prz.high,
                invalidation: p.invalidation,
                status: p.status,
              });
              const dTime = re.d_time ?? (p.D ? p.D.time : null);
              const dPrice = re.d_price ?? (p.D?.price ?? null);
              return {
                user_id: userId,
                scan_run_id: run.id,
                symbol,
                timeframe: data.timeframe,
                pattern_name: p.name,
                direction: p.direction,
                status: re.status,
                confidence: Number(p.confidence.toFixed(4)),
                x_date: p.X ? new Date(p.X.time * 1000).toISOString() : null,
                x_price: p.X?.price ?? null,
                a_date: new Date(p.A.time * 1000).toISOString(),
                a_price: p.A.price,
                b_date: new Date(p.B.time * 1000).toISOString(),
                b_price: p.B.price,
                c_date: cIso,
                c_price: p.C.price,
                d_date: dTime != null ? new Date(dTime * 1000).toISOString() : null,
                d_price: dPrice,
                prz_low: p.prz.low,
                prz_high: p.prz.high,
                invalidation: p.invalidation,
                progress_pct: p.progressPct ?? null,
                ratios: p.ratios,
              };
            })
            // Jangan simpan pola yang sudah invalid — agar hasil scan konsisten
            // dengan tampilan setelah refresh.
            .filter((r) => r.status !== "invalid");
          if (rows.length > 0) {
            const { error: insErr } = await supabase.from("patterns").insert(rows);
            if (insErr) errors.push(`${symbol}: ${insErr.message}`);
            else totalFound += rows.length;
          }
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

    return { runId: run.id, patternsFound: totalFound, patternsInvalidated: totalInvalidated, errors };
  });

import type { Bar } from "./types";

export type RsiPoint = { time: number; value: number };

/**
 * Wilder's RSI (Relative Strength Index).
 * Mengembalikan deret RSI selaras dengan `bars` (index pertama yang punya nilai
 * adalah index ke-`period`). Memakai smoothing Wilder agar konsisten dengan
 * platform charting umum.
 */
export function computeRSI(bars: Bar[], period = 14): RsiPoint[] {
  const out: RsiPoint[] = [];
  if (bars.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const rsiAt = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));

  out.push({ time: bars[period].time, value: rsiAt(avgGain, avgLoss) });

  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push({ time: bars[i].time, value: rsiAt(avgGain, avgLoss) });
  }

  return out;
}

export type RsiConfirmation = {
  value: number; // RSI terkini
  zone: "oversold" | "overbought" | "neutral";
  confirmed: boolean;
  divergence: "bullish" | "bearish" | null;
  touchedExtreme: boolean; // true jika 7 hari terakhir RSI menyentuh ekstrem (<30 untuk bullish, >70 untuk bearish)
  message: string;
};

/**
 * Evaluasi apakah RSI mengkonfirmasi pola harmonik.
 * - Bullish: RSI oversold (<=30) atau bullish divergence mengkonfirmasi potensi pantulan naik.
 * - Bearish: RSI overbought (>=70) atau bearish divergence mengkonfirmasi potensi koreksi turun.
 *
 * Divergence dideteksi dengan membandingkan ayunan harga vs RSI sejak titik C.
 */
export function evaluateRsiConfirmation(
  bars: Bar[],
  direction: "bullish" | "bearish",
  cDate: string | null,
  period = 14,
): RsiConfirmation | null {
  const series = computeRSI(bars, period);
  if (series.length === 0) return null;
  const value = series[series.length - 1].value;

  const zone: RsiConfirmation["zone"] =
    value <= 30 ? "oversold" : value >= 70 ? "overbought" : "neutral";

  // Deteksi divergence sederhana sejak titik C (jika ada).
  let divergence: RsiConfirmation["divergence"] = null;
  const cTime = cDate ? Math.floor(Date.parse(cDate) / 1000) : NaN;
  if (Number.isFinite(cTime)) {
    const rsiByTime = new Map(series.map((p) => [p.time, p.value]));
    const seg = bars.filter((b) => b.time >= cTime && rsiByTime.has(b.time));
    if (seg.length >= 4) {
      const half = Math.floor(seg.length / 2);
      const first = seg.slice(0, half);
      const last = seg.slice(half);
      if (direction === "bullish") {
        const priceLow1 = Math.min(...first.map((b) => b.low));
        const priceLow2 = Math.min(...last.map((b) => b.low));
        const rsiLow1 = Math.min(...first.map((b) => rsiByTime.get(b.time)!));
        const rsiLow2 = Math.min(...last.map((b) => rsiByTime.get(b.time)!));
        // harga membuat lower low tapi RSI higher low → bullish divergence
        if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1) divergence = "bullish";
      } else {
        const priceHigh1 = Math.max(...first.map((b) => b.high));
        const priceHigh2 = Math.max(...last.map((b) => b.high));
        const rsiHigh1 = Math.max(...first.map((b) => rsiByTime.get(b.time)!));
        const rsiHigh2 = Math.max(...last.map((b) => rsiByTime.get(b.time)!));
        // harga membuat higher high tapi RSI lower high → bearish divergence
        if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1) divergence = "bearish";
      }
    }
  }

  const zoneOk = direction === "bullish" ? zone === "oversold" : zone === "overbought";
  const divOk =
    (direction === "bullish" && divergence === "bullish") ||
    (direction === "bearish" && divergence === "bearish");
  const confirmed = zoneOk || divOk;

  // Periksa apakah RSI menyentuh ekstrem dalam 7 hari terakhir.
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  const lastTime = series[series.length - 1].time;
  const touchedExtreme = direction === "bullish"
    ? series.some((p) => p.time >= lastTime - SEVEN_DAYS && p.value <= 30)
    : series.some((p) => p.time >= lastTime - SEVEN_DAYS && p.value >= 70);

  let message: string;
  if (confirmed) {
    const reasons: string[] = [];
    if (zoneOk) reasons.push(direction === "bullish" ? "RSI oversold (<30)" : "RSI overbought (>70)");
    if (divOk) reasons.push(`${direction === "bullish" ? "bullish" : "bearish"} divergence`);
    message = `Terkonfirmasi: ${reasons.join(" + ")} mendukung pola ${direction === "bullish" ? "bullish (potensi naik)" : "bearish (potensi turun)"}.`;
  } else {
    message =
      direction === "bullish"
        ? "RSI belum oversold dan belum ada bullish divergence di sekitar PRZ."
        : "RSI belum overbought dan belum ada bearish divergence di sekitar PRZ.";
  }

  return { value, zone, confirmed, divergence, touchedExtreme, message };
}

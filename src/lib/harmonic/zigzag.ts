import type { Bar, Pivot } from "./types";

/**
 * Simple percentage-based ZigZag pivot detector.
 * Returns alternating H/L pivots from oldest to newest.
 */
export function zigzag(bars: Bar[], thresholdPct = 3): Pivot[] {
  if (bars.length < 3) return [];
  const t = thresholdPct / 100;
  const pivots: Pivot[] = [];

  let lastPivotIdx = 0;
  let lastPivotPrice = bars[0].close;
  let direction: "up" | "down" | null = null;
  let extremeIdx = 0;
  let extremePrice = bars[0].close;

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (direction === null) {
      if (b.high >= lastPivotPrice * (1 + t)) {
        direction = "up";
        extremeIdx = i;
        extremePrice = b.high;
        pivots.push({ index: lastPivotIdx, time: bars[lastPivotIdx].time, price: lastPivotPrice, type: "L" });
      } else if (b.low <= lastPivotPrice * (1 - t)) {
        direction = "down";
        extremeIdx = i;
        extremePrice = b.low;
        pivots.push({ index: lastPivotIdx, time: bars[lastPivotIdx].time, price: lastPivotPrice, type: "H" });
      }
      continue;
    }

    if (direction === "up") {
      if (b.high > extremePrice) {
        extremePrice = b.high;
        extremeIdx = i;
      } else if (b.low <= extremePrice * (1 - t)) {
        // confirm pivot high
        pivots.push({ index: extremeIdx, time: bars[extremeIdx].time, price: extremePrice, type: "H" });
        direction = "down";
        lastPivotIdx = extremeIdx;
        lastPivotPrice = extremePrice;
        extremeIdx = i;
        extremePrice = b.low;
      }
    } else {
      if (b.low < extremePrice) {
        extremePrice = b.low;
        extremeIdx = i;
      } else if (b.high >= extremePrice * (1 + t)) {
        pivots.push({ index: extremeIdx, time: bars[extremeIdx].time, price: extremePrice, type: "L" });
        direction = "up";
        lastPivotIdx = extremeIdx;
        lastPivotPrice = extremePrice;
        extremeIdx = i;
        extremePrice = b.high;
      }
    }
  }

  // append the running extreme as a tentative pivot (useful for developing patterns)
  if (direction !== null) {
    const lastConfirmed = pivots[pivots.length - 1];
    const pendingType: "H" | "L" = direction === "up" ? "H" : "L";
    if (!lastConfirmed || lastConfirmed.type !== pendingType) {
      pivots.push({
        index: extremeIdx,
        time: bars[extremeIdx].time,
        price: extremePrice,
        type: pendingType,
      });
    }
  }

  return pivots;
}

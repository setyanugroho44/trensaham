import type { PatternName } from "./types";

// Each rule: ratio target ranges relative to specific legs.
// AB := |B-A| / |A-X|
// BC := |C-B| / |B-A|
// CD := |D-C| / |C-B|
// AD := |D-A| / |A-X|

export type RatioRange = { min: number; max: number; ideal: number };

export type PatternSpec = {
  name: PatternName;
  AB: RatioRange;
  BC: RatioRange;
  CD: RatioRange;
  AD: RatioRange;
};

const r = (min: number, max: number, ideal?: number): RatioRange => ({
  min,
  max,
  ideal: ideal ?? (min + max) / 2,
});

export const PATTERNS: PatternSpec[] = [
  {
    name: "Gartley",
    AB: r(0.618, 0.618, 0.618),
    BC: r(0.382, 0.886),
    CD: r(1.27, 1.618),
    AD: r(0.786, 0.786, 0.786),
  },
  {
    name: "Bat",
    AB: r(0.382, 0.5),
    BC: r(0.382, 0.886),
    CD: r(1.618, 2.618),
    AD: r(0.886, 0.886, 0.886),
  },
  {
    name: "Butterfly",
    AB: r(0.786, 0.786, 0.786),
    BC: r(0.382, 0.886),
    CD: r(1.618, 2.24),
    AD: r(1.27, 1.618),
  },
  {
    name: "Crab",
    AB: r(0.382, 0.618),
    BC: r(0.382, 0.886),
    CD: r(2.24, 3.618),
    AD: r(1.618, 1.618, 1.618),
  },
  {
    name: "Shark",
    AB: r(0.382, 0.618),
    BC: r(1.13, 1.618),
    CD: r(1.618, 2.24),
    AD: r(0.886, 1.13),
  },
  {
    name: "Cypher",
    AB: r(0.382, 0.618),
    BC: r(1.27, 1.414),
    CD: r(1.27, 2.0),
    AD: r(0.786, 0.786, 0.786),
  },
  {
    name: "AB=CD",
    AB: r(0.0, 10),
    BC: r(0.382, 0.886),
    CD: r(1.13, 1.618),
    AD: r(0.0, 10),
  },
];

/** Score a measured ratio against a target range. 1.0 = perfect, 0 = out of tolerance. */
export function scoreRatio(measured: number, range: RatioRange, tolerance = 0.05): number {
  if (measured >= range.min * (1 - tolerance) && measured <= range.max * (1 + tolerance)) {
    const dev = Math.abs(measured - range.ideal) / range.ideal;
    return Math.max(0, 1 - dev * 2);
  }
  return 0;
}

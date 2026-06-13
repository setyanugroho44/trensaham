import type { PatternName } from "./types";

// Each rule: ratio target ranges relative to specific legs.
// AB := |B-A| / |A-X|
// BC := |C-B| / |B-A|
// CD := |D-C| / |C-B|
// AD := |D-A| / |A-X|
// XC_D := |D-C| / |C-X|   (rasio khusus, dipakai untuk validasi titik D pada Cypher)
export type RatioRange = { min: number; max: number; ideal: number };
export type PatternSpec = {
  name: PatternName;
  AB: RatioRange;
  BC: RatioRange;
  CD: RatioRange;
  AD: RatioRange;
  // Optional: rasio tambahan berbasis leg XC, hanya relevan untuk Cypher
  XC_D?: RatioRange;
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
    // SHARK — diperbaiki:
    // B adalah EKSTENSI dari XA (bisa melewati X), bukan retracement biasa.
    // AB (=|B-A|/|A-X|) -> 1.13 - 1.618
    // BC (=|C-B|/|B-A|) -> ekstensi C dari AB, 1.618 - 2.24
    // CD (=|D-C|/|C-B|) -> 1.13 - 1.618
    // AD (=|D-A|/|A-X|) -> 0.886 - 1.13 (sudah benar sebelumnya, dipertahankan)
    name: "Shark",
    AB: r(1.13, 1.618),
    BC: r(1.618, 2.24),
    CD: r(1.13, 1.618),
    AD: r(0.886, 1.13),
  },
  {
    // CYPHER — diperbaiki:
    // AB & BC dipertahankan (sudah cukup mendekati standar: 0.382-0.618 dan ~1.13-1.414).
    // AD (XAD) DIHAPUS sebagai syarat ketat karena Cypher tidak punya rasio
    // tetap XD/XA — diganti jadi rentang lebar (tidak signifikan terhadap skor).
    // Syarat sebenarnya untuk titik D ada di XC_D: |D-C|/|C-X| = 0.786.
    name: "Cypher",
    AB: r(0.382, 0.618),
    BC: r(1.13, 1.414),
    CD: r(1.272, 2.0),
    AD: r(0.0, 10), // tidak digunakan sebagai kriteria ketat
    XC_D: r(0.786, 0.786, 0.786),
  },
  {
    name: "AB=CD",
    AB: r(0.0, 10),
    BC: r(0.382, 0.886),
    CD: r(1.13, 1.618),
    AD: r(0.0, 10),
  },
];

/**
 * Score a measured ratio against a target range. 1.0 = perfect, 0 = out of tolerance.
 *
 * Setiap rasio yang jatuh DI DALAM rentang valid [min, max] dianggap sempurna
 * (skor 1.0), karena syarat pola harmonik adalah rasio berada di dalam rentang —
 * bukan tepat di titik tengah. Untuk rasio "titik" (min == max), skor 1.0 dicapai
 * tepat pada target. Di luar rentang namun masih dalam toleransi, skor meluruh
 * linear menuju 0 di tepi pita toleransi. Dengan begitu pola yang seluruh rasionya
 * pas di dalam rentang dapat mencapai confidence 100%.
 */
export function scoreRatio(measured: number, range: RatioRange, tolerance = 0.05): number {
  const lo = range.min * (1 - tolerance);
  const hi = range.max * (1 + tolerance);
  if (measured < lo || measured > hi) return 0;
  // Di dalam rentang inti → sempurna.
  if (measured >= range.min && measured <= range.max) return 1;
  // Di pita toleransi → meluruh linear menuju 0 di tepi pita.
  const margin =
    measured < range.min
      ? (range.min - measured) / Math.max(1e-9, range.min - lo)
      : (measured - range.max) / Math.max(1e-9, hi - range.max);
  return Math.max(0, 1 - margin);
}

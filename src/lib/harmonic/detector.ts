import type { Bar, DetectedPattern, Direction, Pivot } from "./types";
import { PATTERNS, scoreRatio, type PatternSpec } from "./patterns";

const DEFAULT_TOL = 0.05; // 5%

function legAbs(a: Pivot, b: Pivot) {
  return Math.abs(b.price - a.price);
}

/** Validate XABCD pivot alternation for a direction. Bullish: X=L,A=H,B=L,C=H,D=L. */
function validShape(X: Pivot, A: Pivot, B: Pivot, C: Pivot, D: Pivot | null, dir: Direction): boolean {
  const seq = dir === "bullish" ? ["L", "H", "L", "H", "L"] : ["H", "L", "H", "L", "H"];
  if (X.type !== seq[0] || A.type !== seq[1] || B.type !== seq[2] || C.type !== seq[3]) return false;
  if (D && D.type !== seq[4]) return false;

  // monotonic constraints
  if (dir === "bullish") {
    if (!(A.price > X.price && B.price < A.price && B.price > X.price && C.price > B.price && C.price < A.price)) return false;
    if (D && !(D.price < C.price)) return false;
  } else {
    if (!(A.price < X.price && B.price > A.price && B.price < X.price && C.price < B.price && C.price > A.price)) return false;
    if (D && !(D.price > C.price)) return false;
  }
  return true;
}

function ratiosOf(X: Pivot, A: Pivot, B: Pivot, C: Pivot, D?: Pivot) {
  const XA = legAbs(X, A);
  const AB = legAbs(A, B);
  const BC = legAbs(B, C);
  return {
    AB: AB / XA,
    BC: BC / AB,
    CD: D ? legAbs(C, D) / BC : NaN,
    AD: D ? legAbs(A, D) / XA : NaN,
  };
}

/**
 * Project the PRZ (Potential Reversal Zone) based on confluence of:
 *   - XA retracement (AD ratio)
 *   - BC projection (CD ratio)
 *
 * PERUBAHAN dari versi sebelumnya:
 *   - Toleransi TIDAK lagi diterapkan di sini. Toleransi sudah dipakai di
 *     scoreRatio() saat validasi rasio. Menerapkannya dua kali membuat PRZ
 *     terlalu lebar dan tidak mencerminkan zona proyeksi yang sesungguhnya.
 *   - Ditambahkan guard: PRZ harus berada di sisi yang benar relatif terhadap C.
 *     Bullish → PRZ di bawah C; Bearish → PRZ di atas C. Jika tidak, pola dibuang.
 */
function projectD(
  X: Pivot,
  A: Pivot,
  B: Pivot,
  C: Pivot,
  spec: PatternSpec,
  dir: Direction,
): { low: number; high: number } | null {
  const XA = legAbs(X, A);
  const BC = legAbs(B, C);

  // Gunakan batas spec langsung — tanpa toleransi tambahan.
  const adA = A.price + (dir === "bullish" ? -1 : 1) * XA * spec.AD.max;
  const adB = A.price + (dir === "bullish" ? -1 : 1) * XA * spec.AD.min;
  const cdA = C.price + (dir === "bullish" ? -1 : 1) * BC * spec.CD.max;
  const cdB = C.price + (dir === "bullish" ? -1 : 1) * BC * spec.CD.min;

  const adLo = Math.min(adA, adB);
  const adHi = Math.max(adA, adB);
  const cdLo = Math.min(cdA, cdB);
  const cdHi = Math.max(cdA, cdB);

  const lo = Math.max(adLo, cdLo);
  const hi = Math.min(adHi, cdHi);

  if (lo > hi) return null; // no confluence → invalid pattern

  // Guard: PRZ harus berada di sisi yang benar relatif terhadap C.
  if (dir === "bullish" && hi >= C.price) return null;
  if (dir === "bearish" && lo <= C.price) return null;

  // Bulatkan ke fraksi harga IDX: low ke bawah, high ke atas.
  return { low: floorToIdxTick(lo), high: ceilToIdxTick(hi) };
}

// ---------------------------------------------------------------------------
// Tick size & rounding helpers untuk IDX
// < 200 → 1, 200–<500 → 2, 500–<2000 → 5, 2000–<5000 → 10, ≥5000 → 25
// ---------------------------------------------------------------------------
export function idxTickSize(price: number): number {
  const p = Math.abs(price);
  if (p < 200) return 1;
  if (p < 500) return 2;
  if (p < 2000) return 5;
  if (p < 5000) return 10;
  return 25;
}
export function floorToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.floor(price / t) * t;
}
export function ceilToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.ceil(price / t) * t;
}

function evalSpec(
  X: Pivot,
  A: Pivot,
  B: Pivot,
  C: Pivot,
  D: Pivot | null,
  spec: PatternSpec,
  dir: Direction,
  tol = DEFAULT_TOL,
): { score: number; ratios: Record<string, number> } | null {
  if (!validShape(X, A, B, C, D, dir)) return null;
  const rs = ratiosOf(X, A, B, C, D ?? undefined);
  const sAB = scoreRatio(rs.AB, spec.AB, tol);
  const sBC = scoreRatio(rs.BC, spec.BC, tol);
  if (sAB === 0 || sBC === 0) return null;
  if (D) {
    const sCD = scoreRatio(rs.CD, spec.CD, tol);
    const sAD = scoreRatio(rs.AD, spec.AD, tol);
    if (sCD === 0 || sAD === 0) return null;
    const score = (sAB + sBC + sCD + sAD) / 4;
    return { score, ratios: rs };
  }
  return { score: (sAB + sBC) / 2, ratios: rs };
}

export type DetectOptions = {
  tolerance?: number;       // fraction, default 0.05
  minConfidence?: number;   // default 0.4
  minBarsSpan?: number;     // minimum bars from X to C (or D), default 20
  minLegPct?: number;       // minimum |XA|/A as fraction, default 0.08 (8%)
  /**
   * Faktor overshoot untuk AB=CD dan extension patterns (Butterfly, Crab).
   * Invalidasi dihitung sebagai PRZ ± (lebar PRZ × overshotFactor).
   * Default 0.5 — artinya buffer = 50% lebar PRZ di luar zona.
   * Nilai ini mencerminkan overshoot wajar yang sering terjadi di pasar
   * sebelum harga berbalik dari PRZ.
   */
  overshootFactor?: number; // default 0.5
};

export function detectPatterns(
  pivots: Pivot[],
  bars: Bar[],
  opts: DetectOptions = {},
): DetectedPattern[] {
  const tol            = opts.tolerance      ?? DEFAULT_TOL;
  const minConf        = opts.minConfidence  ?? 0.4;
  const minSpan        = opts.minBarsSpan    ?? 20;
  const minLegPct      = opts.minLegPct      ?? 0.08;
  const overshootFactor = opts.overshootFactor ?? 0.5;
  const out: DetectedPattern[] = [];
  if (pivots.length < 4) return out;

  const lastBar = bars[bars.length - 1];

  // ---------------------------------------------------------------------------
  // Klasifikasi pola
  // ---------------------------------------------------------------------------
  // Retracement patterns: D berada antara A dan X → invalidasi di X (dengan buffer 1 tick).
  // Extension patterns  : D melampaui X → invalidasi di tepi luar PRZ + overshoot buffer.
  // AB=CD               : tidak memakai kaki XA → invalidasi di tepi luar PRZ + overshoot buffer.
  //
  // PERUBAHAN dari versi sebelumnya:
  //   - Shark dikeluarkan dari RETRACEMENT_PATTERNS karena rasio AD-nya bisa > 1.0
  //     (kaki D melampaui X), sehingga lebih tepat diperlakukan sebagai extension.
  //   - Invalidasi retracement sekarang X ± 1 tick (bukan tepat di X), agar harga
  //     yang hanya "menyentuh" X tidak langsung membatalkan pola — butuh close di luarnya.
  //   - Invalidasi AB=CD dan extension diperlebar dengan overshoot buffer berbasis
  //     lebar PRZ, menggantikan penggunaan prz.low/high secara langsung sebagai
  //     batas invalidasi.
  // ---------------------------------------------------------------------------
  const RETRACEMENT_PATTERNS = new Set(["Gartley", "Bat", "Cypher"]);
  // Shark & Butterfly & Crab → extension (D bisa melampaui X)

  function invalidationFor(
    name: string,
    dir: Direction,
    X: Pivot,
    prz: { low: number; high: number },
  ): number {
    const przWidth = prz.high - prz.low;
    // Minimal buffer = 1 tick dari harga X (untuk kasus PRZ sangat sempit).
    const minBuf = idxTickSize(X.price);

    if (RETRACEMENT_PATTERNS.has(name)) {
      // Invalidasi: 1 tick di luar X.
      // Harga harus menembus X — sekadar menyentuh belum membatalkan pola.
      return dir === "bullish"
        ? floorToIdxTick(X.price - minBuf)
        : ceilToIdxTick(X.price + minBuf);
    }

    // AB=CD dan extension patterns: invalidasi di luar PRZ + overshoot buffer.
    // Buffer = max(lebar PRZ × overshootFactor, 1 tick).
    const buffer = Math.max(przWidth * overshootFactor, minBuf);
    if (name === "AB=CD") {
      return dir === "bullish"
        ? floorToIdxTick(prz.low - buffer)
        : ceilToIdxTick(prz.high + buffer);
    }
    // Butterfly, Crab, Shark → extension
    return dir === "bullish"
      ? floorToIdxTick(prz.low - buffer)
      : ceilToIdxTick(prz.high + buffer);
  }

  // ---------------------------------------------------------------------------
  // Size / significance filters
  // ---------------------------------------------------------------------------
  function isLargeEnough(X: Pivot, C: Pivot): boolean {
    const legPct = Math.abs(X.price - C.price) / Math.max(1e-9, Math.abs(X.price));
    if (legPct < minLegPct) return false;
    if (C.index - X.index < minSpan) return false;
    return true;
  }

  function patternLargeEnough(
    name: string,
    X: Pivot,
    A: Pivot,
    B: Pivot,
    C: Pivot,
    D: Pivot | null,
  ): boolean {
    if (name === "AB=CD") {
      const abPct = Math.abs(A.price - B.price) / Math.max(1e-9, Math.abs(A.price));
      if (abPct < minLegPct) return false;
      const end = D ?? C;
      if (end.index - A.index < minSpan) return false;
      return true;
    }
    return isLargeEnough(X, C);
  }

  // ---------------------------------------------------------------------------
  // Validasi posisi D terhadap PRZ (completed patterns)
  //
  // PERUBAHAN: D harus berada di dalam PRZ atau dalam overshoot buffer di luarnya.
  // Sebelumnya hanya dicek via rasio; dengan cek ini, D yang jauh di luar PRZ
  // (meski rasionya lolos toleransi) akan dibuang.
  // ---------------------------------------------------------------------------
  function dInPrz(
    D: Pivot,
    prz: { low: number; high: number },
    dir: Direction,
    przWidth: number,
  ): boolean {
    const buffer = Math.max(przWidth * overshootFactor, idxTickSize(D.price));
    const lo = prz.low  - (dir === "bullish" ? buffer : 0);
    const hi = prz.high + (dir === "bearish" ? buffer : 0);
    return D.price >= lo && D.price <= hi;
  }

  // ---------------------------------------------------------------------------
  // Completed patterns — last 5 pivots
  // ---------------------------------------------------------------------------
  if (pivots.length >= 5) {
    const [X, A, B, C, D] = pivots.slice(-5);
    for (const dir of ["bullish", "bearish"] as Direction[]) {
      for (const spec of PATTERNS) {
        if (!patternLargeEnough(spec.name, X, A, B, C, D)) continue;
        const r = evalSpec(X, A, B, C, D, spec, dir, tol);
        if (!r || r.score < minConf) continue;
        const prz = projectD(X, A, B, C, spec, dir);
        if (!prz) continue;
        const przWidth = prz.high - prz.low;
        // D harus berada di dalam PRZ atau dalam overshoot buffer
        if (!dInPrz(D, prz, dir, przWidth)) continue;
        out.push({
          name: spec.name,
          direction: dir,
          status: "completed",
          confidence: r.score,
          X, A, B, C, D,
          prz,
          invalidation: invalidationFor(spec.name, dir, X, prz),
          ratios: r.ratios,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Developing patterns — last 4 pivots (D belum terbentuk)
  // ---------------------------------------------------------------------------
  if (pivots.length >= 4) {
    const [X, A, B, C] = pivots.slice(-4);
    for (const dir of ["bullish", "bearish"] as Direction[]) {
      for (const spec of PATTERNS) {
        if (!patternLargeEnough(spec.name, X, A, B, C, null)) continue;
        const r = evalSpec(X, A, B, C, null, spec, dir, tol);
        if (!r || r.score < minConf) continue;
        const prz = projectD(X, A, B, C, spec, dir);
        if (!prz) continue;
        const target = (prz.low + prz.high) / 2;
        const totalDist = Math.abs(target - C.price);
        const moved = Math.abs(lastBar.close - C.price);
        const progress = totalDist > 0 ? Math.min(1, moved / totalDist) : 0;
        // Filter: kaki C→PRZ harus sudah terbentuk minimal 15%
        if (progress < 0.15) continue;
        out.push({
          name: spec.name,
          direction: dir,
          status: "developing",
          confidence: r.score,
          X, A, B, C,
          prz,
          invalidation: invalidationFor(spec.name, dir, X, prz),
          progressPct: progress * 100,
          ratios: r.ratios,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Dedup: prefer completed > developing, higher confidence wins
  // ---------------------------------------------------------------------------
  const dedup = new Map<string, DetectedPattern>();
  for (const p of out) {
    const key = `${p.name}-${p.direction}-${p.status}`;
    const cur = dedup.get(key);
    if (!cur || p.confidence > cur.confidence) dedup.set(key, p);
  }
  return Array.from(dedup.values()).sort((a, b) => b.confidence - a.confidence);
}


import type { Bar, DetectedPattern, Direction, Pivot } from "./types";
import { PATTERNS, scoreRatio, type PatternSpec } from "./patterns";

const DEFAULT_TOL = 0.05; // 5%

function legAbs(a: Pivot, b: Pivot) {
  return Math.abs(b.price - a.price);
}

/** Validate XABCD pivot alternation for a direction. Bullish: X=L,A=H,B=L,C=H,D=L. */
function validShape(X: Pivot, A: Pivot, B: Pivot, C: Pivot, D: Pivot | null, dir: Direction): boolean {
  const seq = dir === "bullish" ? ["L", "H", "L", "H", "L"] : ["H", "L", "H", "L", "H"];
  if (X.type !== seq[0] || A.type !== seq[1] || B.type !== seq[2] || C.type !== seq[3]) return false;
  if (D && D.type !== seq[4]) return false;

  // monotonic constraints
  if (dir === "bullish") {
    if (!(A.price > X.price && B.price < A.price && B.price > X.price && C.price > B.price && C.price < A.price)) return false;
    if (D && !(D.price < C.price)) return false;
  } else {
    if (!(A.price < X.price && B.price > A.price && B.price < X.price && C.price < B.price && C.price > A.price)) return false;
    if (D && !(D.price > C.price)) return false;
  }
  return true;
}

function ratiosOf(X: Pivot, A: Pivot, B: Pivot, C: Pivot, D?: Pivot) {
  const XA = legAbs(X, A);
  const AB = legAbs(A, B);
  const BC = legAbs(B, C);
  return {
    AB: AB / XA,
    BC: BC / AB,
    CD: D ? legAbs(C, D) / BC : NaN,
    AD: D ? legAbs(A, D) / XA : NaN,
  };
}

function projectD(X: Pivot, A: Pivot, B: Pivot, C: Pivot, spec: PatternSpec, dir: Direction, tol = DEFAULT_TOL): { low: number; high: number } | null {
  const XA = legAbs(X, A);
  const BC = legAbs(B, C);
  // PRZ must be a confluence: intersection of XA-retracement (AD) and BC-projection (CD).
  // Untuk pola dengan rasio "titik" (mis. Bat AD=0.886, Gartley AD=0.786, Crab AD=1.618),
  // kita lebarkan rentang dengan toleransi agar PRZ tetap berupa zona, bukan satu titik.
  const adMin = spec.AD.min * (1 - tol);
  const adMax = spec.AD.max * (1 + tol);
  const cdMin = spec.CD.min * (1 - tol);
  const cdMax = spec.CD.max * (1 + tol);
  const adA = A.price + (dir === "bullish" ? -1 : 1) * XA * adMax;
  const adB = A.price + (dir === "bullish" ? -1 : 1) * XA * adMin;
  const cdA = C.price + (dir === "bullish" ? -1 : 1) * BC * cdMax;
  const cdB = C.price + (dir === "bullish" ? -1 : 1) * BC * cdMin;
  const adLo = Math.min(adA, adB);
  const adHi = Math.max(adA, adB);
  const cdLo = Math.min(cdA, cdB);
  const cdHi = Math.max(cdA, cdB);
  const lo = Math.max(adLo, cdLo);
  const hi = Math.min(adHi, cdHi);
  if (lo > hi) return null; // no confluence → invalid pattern
  // Bulatkan ke fraksi harga IDX: low ke bawah, high ke atas.
  return { low: floorToIdxTick(lo), high: ceilToIdxTick(hi) };
}

// Fraksi harga (tick size) IDX:
// < 200 → 1, 200–<500 → 2, 500–<2000 → 5, 2000–<5000 → 10, ≥5000 → 25
export function idxTickSize(price: number): number {
  const p = Math.abs(price);
  if (p < 200) return 1;
  if (p < 500) return 2;
  if (p < 2000) return 5;
  if (p < 5000) return 10;
  return 25;
}
export function floorToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.floor(price / t) * t;
}
export function ceilToIdxTick(price: number): number {
  const t = idxTickSize(price);
  return Math.ceil(price / t) * t;
}

function evalSpec(
  X: Pivot,
  A: Pivot,
  B: Pivot,
  C: Pivot,
  D: Pivot | null,
  spec: PatternSpec,
  dir: Direction,
  tol = DEFAULT_TOL,
): { score: number; ratios: Record<string, number> } | null {
  if (!validShape(X, A, B, C, D, dir)) return null;
  const rs = ratiosOf(X, A, B, C, D ?? undefined);
  const sAB = scoreRatio(rs.AB, spec.AB, tol);
  const sBC = scoreRatio(rs.BC, spec.BC, tol);
  if (sAB === 0 || sBC === 0) return null;
  if (D) {
    const sCD = scoreRatio(rs.CD, spec.CD, tol);
    const sAD = scoreRatio(rs.AD, spec.AD, tol);
    if (sCD === 0 || sAD === 0) return null;
    const score = (sAB + sBC + sCD + sAD) / 4;
    return { score, ratios: rs };
  }
  return { score: (sAB + sBC) / 2, ratios: rs };
}

export type DetectOptions = {
  tolerance?: number; // fraction, default 0.05
  minConfidence?: number; // default 0.4
  minBarsSpan?: number; // minimum bars from X to C (or D), default 20
  minLegPct?: number; // minimum |XA|/A as fraction, default 0.08 (8%)
};

export function detectPatterns(
  pivots: Pivot[],
  bars: Bar[],
  opts: DetectOptions = {},
): DetectedPattern[] {
  const tol = opts.tolerance ?? DEFAULT_TOL;
  const minConf = opts.minConfidence ?? 0.4;
  const minSpan = opts.minBarsSpan ?? 20;
  const minLegPct = opts.minLegPct ?? 0.08;
  const out: DetectedPattern[] = [];
  if (pivots.length < 4) return out;

  const lastBar = bars[bars.length - 1];

  // Pattern-specific invalidation level.
  // Retracement patterns (D between A and X): invalidation = X.
  // Extension patterns (D beyond X): invalidation = far edge of PRZ
  // (a break beyond the deepest projection voids the pattern).
  const RETRACEMENT_PATTERNS = new Set(["Gartley", "Bat", "Cypher", "Shark"]);
  function invalidationFor(
    name: string,
    dir: Direction,
    X: Pivot,
    prz: { low: number; high: number },
  ): number {
    // AB=CD tidak memakai kaki X, jadi invalidasinya adalah tepi terjauh PRZ:
    // tembus di luar zona reversal (di bawah PRZ untuk bullish, di atas PRZ
    // untuk bearish) membatalkan pola.
    if (name === "AB=CD") return dir === "bullish" ? prz.low : prz.high;
    if (RETRACEMENT_PATTERNS.has(name)) return X.price;
    // extension patterns: Butterfly, Crab
    return dir === "bullish" ? prz.low : prz.high;
  }

  // Helper: pola dianggap "besar" jika kaki XA cukup signifikan (% terhadap harga)
  // dan rentang waktu X→C cukup panjang (minimal minSpan bar).
  function isLargeEnough(X: Pivot, C: Pivot): boolean {
    const legPct = Math.abs(X.price - C.price) / Math.max(1e-9, Math.abs(X.price));
    if (legPct < minLegPct) return false;
    if (C.index - X.index < minSpan) return false;
    return true;
  }

  // Gate khusus per pola. Untuk AB=CD, kaki XA tidak relevan — yang penting
  // adalah BESARNYA pola inti AB=CD (kaki A→B dan C→D). Banyak kasus XA panjang
  // tapi pola AB=CD-nya kecil/sempit; gate ini menyaringnya dengan mengukur
  // amplitudo kaki AB (% terhadap harga) dan rentang waktu pola inti (A→C/A→D).
  function patternLargeEnough(
    name: string,
    X: Pivot,
    A: Pivot,
    B: Pivot,
    C: Pivot,
    D: Pivot | null,
  ): boolean {
    if (name === "AB=CD") {
      const abPct = Math.abs(A.price - B.price) / Math.max(1e-9, Math.abs(A.price));
      if (abPct < minLegPct) return false;
      const end = D ?? C;
      if (end.index - A.index < minSpan) return false;
      return true;
    }
    return isLargeEnough(X, C);
  }

  // Try last 5 pivots for completed
  if (pivots.length >= 5) {
    const [X, A, B, C, D] = pivots.slice(-5);
    for (const dir of ["bullish", "bearish"] as Direction[]) {
      for (const spec of PATTERNS) {
        if (!patternLargeEnough(spec.name, X, A, B, C, D)) continue;
        const r = evalSpec(X, A, B, C, D, spec, dir, tol);
        if (r && r.score >= minConf) {
          const prz = projectD(X, A, B, C, spec, dir, tol);
          if (!prz) continue; // no confluence between BC projection & XA retracement
          out.push({
            name: spec.name,
            direction: dir,
            status: "completed",
            confidence: r.score,
            X, A, B, C, D,
            prz,
            invalidation: invalidationFor(spec.name, dir, X, prz),
            ratios: r.ratios,
          });
        }
      }
    }
  }

  // Try last 4 pivots for developing (X-A-B-C, D not yet formed)
  if (pivots.length >= 4) {
    const [X, A, B, C] = pivots.slice(-4);
    for (const dir of ["bullish", "bearish"] as Direction[]) {
      for (const spec of PATTERNS) {
        if (!patternLargeEnough(spec.name, X, A, B, C, null)) continue;
        const r = evalSpec(X, A, B, C, null, spec, dir, tol);
        if (r && r.score >= minConf) {
          const prz = projectD(X, A, B, C, spec, dir, tol);
          if (!prz) continue; // no confluence → invalid pattern
          // assume midpoint of PRZ as projected D
          const target = (prz.low + prz.high) / 2;
          const totalDist = Math.abs(target - C.price);
          const moved = Math.abs(lastBar.close - C.price);
          const progress = totalDist > 0 ? Math.min(1, moved / totalDist) : 0;
          // Filter: kaki C->PRZ harus sudah terbentuk minimal 15%
          // untuk meminimalisir pola yang belum jelas dan menghindari
          // dua pola berlawanan muncul bersamaan.
          if (progress < 0.15) continue;
          out.push({
            name: spec.name,
            direction: dir,
            status: "developing",
            confidence: r.score,
            X, A, B, C,
            prz,
            invalidation: invalidationFor(spec.name, dir, X, prz),
            progressPct: progress * 100,
            ratios: r.ratios,
          });
        }
      }
    }
  }

  // dedupe: prefer completed > developing, higher confidence
  const dedup = new Map<string, DetectedPattern>();
  for (const p of out) {
    const key = `${p.name}-${p.direction}-${p.status}`;
    const cur = dedup.get(key);
    if (!cur || p.confidence > cur.confidence) dedup.set(key, p);
  }
  return Array.from(dedup.values()).sort((a, b) => b.confidence - a.confidence);
}

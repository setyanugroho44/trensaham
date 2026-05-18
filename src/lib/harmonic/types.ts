export type Bar = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Pivot = {
  index: number;
  time: number;
  price: number;
  type: "H" | "L";
};

export type PatternName =
  | "Gartley"
  | "Bat"
  | "Butterfly"
  | "Crab"
  | "Deep Crab"
  | "Shark"
  | "Cypher"
  | "AB=CD";

export type Direction = "bullish" | "bearish";

export type DetectedPattern = {
  name: PatternName;
  direction: Direction;
  status: "completed" | "developing";
  confidence: number; // 0..1
  X?: Pivot;
  A: Pivot;
  B: Pivot;
  C: Pivot;
  D?: Pivot;
  prz: { low: number; high: number };
  invalidation: number;
  progressPct?: number; // for developing
  ratios: Record<string, number>;
};

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAccessWithClient } from "./subscription.server";
import { fetchYahooBars, type Timeframe } from "./yahoo.server";
import { zigzag } from "./harmonic/zigzag";
import { detectPatterns } from "./harmonic/detect";
import type { Bar } from "./harmonic/types";

// Ticker IHSG (Jakarta Composite Index) di Yahoo Finance.
const IHSG_TICKER = "^JKSE";

const inputSchema = z.object({
  timeframe: z.enum(["1d", "1wk", "1mo"]),
  tolerance: z.number().min(0.01).max(0.2),
  minConfidence: z.number().min(0).max(1),
  minBarsSpan: z.number().int().min(3).max(80),
  minLegPct: z.number().min(0.01).max(0.5),
  zigzagThreshold: z.number().min(0.5).max(15),
});

export type IhsgDetectInput = z.infer<typeof inputSchema>;

export type IhsgPoint = { date: string; price: number };

export type IhsgPattern = {
  name: string;
  direction: "bullish" | "bearish";
  status: "completed" | "developing";
  confidence: number;
  progressPct: number | null;
  prz_low: number;
  prz_high: number;
  invalidation: number;
  ratios: Record<string, number>;
  points: { X: IhsgPoint | null; A: IhsgPoint; B: IhsgPoint; C: IhsgPoint; D: IhsgPoint | null };
};

export const detectIhsgPatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: IhsgDetectInput) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAccessWithClient(context.supabase, context.userId);

    const bars: Bar[] = await fetchYahooBars(IHSG_TICKER, data.timeframe as Timeframe);
    if (bars.length < 30) {
      return { bars, patterns: [] as IhsgPattern[], message: "Data IHSG tidak cukup untuk dianalisis." };
    }

    const pivots = zigzag(bars, data.zigzagThreshold);
    const detected = detectPatterns(pivots, bars, {
      tolerance: data.tolerance,
      minConfidence: data.minConfidence,
      minBarsSpan: data.minBarsSpan,
      minLegPct: data.minLegPct,
    });

    const toPoint = (p?: { time: number; price: number } | null): IhsgPoint | null =>
      p ? { date: new Date(p.time * 1000).toISOString(), price: p.price } : null;

    const patterns: IhsgPattern[] = detected.map((p) => ({
      name: p.name,
      direction: p.direction,
      status: p.status,
      confidence: Number(p.confidence.toFixed(4)),
      progressPct: p.progressPct ?? null,
      prz_low: p.prz.low,
      prz_high: p.prz.high,
      invalidation: p.invalidation,
      ratios: p.ratios,
      points: {
        X: toPoint(p.X),
        A: toPoint(p.A)!,
        B: toPoint(p.B)!,
        C: toPoint(p.C)!,
        D: toPoint(p.D),
      },
    }));

    return { bars, patterns };
  });

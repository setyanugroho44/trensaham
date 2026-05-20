import type { Bar } from "./harmonic/types";

type YahooChart = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

export type Timeframe = "1d" | "1wk" | "1mo";

/** Map our timeframe to yahoo (interval, range). */
function ytfParams(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case "1wk":
      return { interval: "1wk", range: "10y" };
    case "1mo":
      return { interval: "1mo", range: "max" };
    case "1d":
    default:
      return { interval: "1d", range: "2y" };
  }
}

/** Fetch OHLC bars for an IDX symbol (e.g. "ASII"). */
export async function fetchYahooBars(symbol: string, tf: Timeframe): Promise<Bar[]> {
  const ticker = symbol.includes(".") ? symbol : `${symbol.toUpperCase()}.JK`;
  const { interval, range } = ytfParams(tf);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=${interval}&range=${range}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    Accept: "application/json",
  };

  let res: Response | null = null;
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    res = await fetch(url, { headers });
    if (res.ok) break;
    if (res.status === 429 || res.status >= 500) {
      // Exponential backoff with jitter
      const delay = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    break;
  }
  if (!res || !res.ok) {
    if (res?.status === 429 || (res && res.status >= 500)) {
      console.warn(`Yahoo ${res.status} for ${ticker}; trying Stooq fallback.`);
      const fb = await fetchStooqBars(symbol, tf);
      if (fb.length) return fb;
      return [];
    }
    // Try Stooq as a last resort before giving up entirely.
    const fb = await fetchStooqBars(symbol, tf);
    if (fb.length) return fb;
    throw new Error(`Yahoo fetch failed: ${res?.status ?? "no response"}`);
  }

  const json = (await res.json()) as YahooChart;
  if (json.chart.error) throw new Error(json.chart.error.description);
  const result = json.chart.result?.[0];
  if (!result) return [];
  const ts = result.timestamp ?? [];
  const q = result.indicators.quote[0];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    bars.push({ time: ts[i], open: o, high: h, low: l, close: c });
  }

  return bars;
}

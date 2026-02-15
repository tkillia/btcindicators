export interface ExchangePrice {
  timestamp: number;
  date: string;
  close: number;
}

/**
 * Fetch daily BTC/USDT candles from Binance.
 * Free, no auth. Max 1000 candles per request.
 */
export async function fetchBinancePrices(
  days = 1000
): Promise<ExchangePrice[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${days}`,
    { next: { tags: ["exchange-data"], revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter((k) => Array.isArray(k) && k.length >= 5)
    .map((k) => {
      const ts = Math.floor((k[0] as number) / 1000);
      return {
        timestamp: ts,
        date: new Date(ts * 1000).toISOString().split("T")[0],
        close: parseFloat(k[4] as string),
      };
    });
}

/**
 * Fetch daily BTC-USD candles from Coinbase Exchange.
 * Free, no auth. Max 300 candles per request — chunks fetched in parallel.
 */
export async function fetchCoinbasePrices(
  days = 1000
): Promise<ExchangePrice[]> {
  const now = new Date();
  const chunkSize = 300;

  // Pre-compute chunk ranges
  const chunks: Array<{ start: string; end: string }> = [];
  for (let offset = 0; offset < days; offset += chunkSize) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() - offset);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - chunkSize);
    chunks.push({ start: start.toISOString(), end: end.toISOString() });
  }

  // Fetch all chunks in parallel
  const responses = await Promise.all(
    chunks.map(({ start, end }) =>
      fetch(
        `https://api.exchange.coinbase.com/products/BTC-USD/candles?` +
          `granularity=86400&start=${start}&end=${end}`,
        { next: { tags: ["exchange-data"], revalidate: 86400 } }
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );

  const results: ExchangePrice[] = [];
  for (const data of responses) {
    if (!Array.isArray(data)) continue;
    for (const candle of data) {
      if (!Array.isArray(candle) || candle.length < 5) continue;
      results.push({
        timestamp: candle[0],
        date: new Date(candle[0] * 1000).toISOString().split("T")[0],
        close: candle[4],
      });
    }
  }

  // Dedupe by date and sort ascending
  const byDate = new Map<string, ExchangePrice>();
  for (const r of results) {
    byDate.set(r.date, r);
  }
  return Array.from(byDate.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );
}

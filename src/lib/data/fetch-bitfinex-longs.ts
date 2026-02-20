export interface BitfinexLongsPoint {
  timestamp: number;
  date: string;
  longs: number; // total BTC margin longs
}

const MS_PER_DAY = 86400 * 1000;
const POINTS_PER_CHUNK = 10000;
const CHUNK_SPAN_MS = POINTS_PER_CHUNK * 3600 * 1000; // ~417 days at 1h resolution

/**
 * Fetch Bitfinex BTC margin longs history.
 * Uses 1-hour resolution for efficient pagination (417 days per chunk),
 * then resamples to daily.
 */
export async function fetchBitfinexLongs(
  days = 1825
): Promise<BitfinexLongsPoint[]> {
  const now = Date.now();
  const startMs = now - days * MS_PER_DAY;

  // Pre-compute all chunk ranges
  const chunks: Array<{ start: number; end: number }> = [];
  let cursor = now;
  while (cursor > startMs) {
    const chunkStart = Math.max(cursor - CHUNK_SPAN_MS, startMs);
    chunks.push({ start: chunkStart, end: cursor });
    cursor = chunkStart - 1;
  }

  // Fetch chunks sequentially to avoid Bitfinex rate limits
  const dailyMap = new Map<string, { timestamp: number; longs: number }>();

  for (const { start, end } of chunks) {
    const url =
      `https://api-pub.bitfinex.com/v2/stats1/pos.size:1h:tBTCUSD:long/hist` +
      `?start=${start}&end=${end}&limit=${POINTS_PER_CHUNK}&sort=-1`;

    let data: unknown = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          next: { tags: ["bitfinex-data"], revalidate: 86400 },
        });
        if (r.status === 429) {
          console.warn(`[bitfinex] rate-limited, waiting 5s (attempt ${attempt + 1})`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }
        if (!r.ok) {
          console.warn(`[bitfinex] HTTP ${r.status} for chunk ${start}-${end}`);
          break;
        }
        data = await r.json();
        break;
      } catch (err) {
        console.warn(`[bitfinex] fetch error (attempt ${attempt + 1}):`, err);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (Array.isArray(data)) {
      for (const [ts, value] of data) {
        const date = new Date(ts).toISOString().split("T")[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            timestamp: Math.floor(ts / 1000),
            longs: value,
          });
        }
      }
    }
  }

  return Array.from(dailyMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([date, d]) => ({
      timestamp: d.timestamp,
      date,
      longs: d.longs,
    }));
}

export interface BitfinexLongsPoint {
  timestamp: number;
  date: string;
  longs: number; // total BTC margin longs
}

const MS_PER_DAY = 86400 * 1000;
const POINTS_PER_CHUNK = 10000;
const CHUNK_SPAN_MS = POINTS_PER_CHUNK * 60 * 1000; // ~7 days at 1m resolution

/**
 * Fetch Bitfinex BTC margin longs history.
 * The API only exposes 1-minute resolution, so we paginate backwards
 * and resample to daily. Runs once per day via ISR.
 */
export async function fetchBitfinexLongs(
  days = 180
): Promise<BitfinexLongsPoint[]> {
  const now = Date.now();
  const startMs = now - days * MS_PER_DAY;
  const dailyMap = new Map<string, { timestamp: number; longs: number }>();

  let cursor = now;

  while (cursor > startMs) {
    const chunkStart = Math.max(cursor - CHUNK_SPAN_MS, startMs);

    const url =
      `https://api-pub.bitfinex.com/v2/stats1/pos.size:1m:tBTCUSD:long/hist` +
      `?start=${chunkStart}&end=${cursor}&limit=${POINTS_PER_CHUNK}&sort=-1`;

    const res = await fetch(url, {
      next: { tags: ["bitfinex-data"], revalidate: 86400 },
    });

    if (!res.ok) break;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const [ts, value] of data) {
      const date = new Date(ts).toISOString().split("T")[0];
      // Keep the latest reading per day
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { timestamp: Math.floor(ts / 1000), longs: value });
      }
    }

    // Move cursor before the oldest point in this chunk
    const oldestTs = data[data.length - 1][0];
    cursor = oldestTs - 1;
  }

  return Array.from(dailyMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([date, d]) => ({
      timestamp: d.timestamp,
      date,
      longs: d.longs,
    }));
}

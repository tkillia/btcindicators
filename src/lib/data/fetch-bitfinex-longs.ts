export interface BitfinexLongsPoint {
  timestamp: number;
  date: string;
  longs: number; // total BTC margin longs
}

const MS_PER_DAY = 86400 * 1000;
const POINTS_PER_CHUNK = 10000;
const CHUNK_SPAN_MS = POINTS_PER_CHUNK * 60 * 1000; // ~7 days at 1m resolution
const PARALLEL_BATCH = 5;

/**
 * Fetch Bitfinex BTC margin longs history.
 * The API only exposes 1-minute resolution, so we paginate backwards
 * and resample to daily. Chunks are fetched in parallel batches.
 */
export async function fetchBitfinexLongs(
  days = 180
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

  // Fetch in parallel batches
  const dailyMap = new Map<string, { timestamp: number; longs: number }>();

  for (let i = 0; i < chunks.length; i += PARALLEL_BATCH) {
    const batch = chunks.slice(i, i + PARALLEL_BATCH);
    const responses = await Promise.all(
      batch.map(({ start, end }) =>
        fetch(
          `https://api-pub.bitfinex.com/v2/stats1/pos.size:1m:tBTCUSD:long/hist` +
            `?start=${start}&end=${end}&limit=${POINTS_PER_CHUNK}&sort=-1`,
          { next: { tags: ["bitfinex-data"], revalidate: 86400 } }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    );

    for (const data of responses) {
      if (!Array.isArray(data)) continue;
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

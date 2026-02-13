interface DefiLlamaEntry {
  date: string; // unix timestamp as string
  totalCirculatingUSD: {
    peggedUSD: number;
  };
}

export interface StablecoinDataPoint {
  timestamp: number;
  date: string;
  supply: number;
}

async function fetchStablecoinChart(
  id: number
): Promise<StablecoinDataPoint[]> {
  const res = await fetch(
    `https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=${id}`,
    { next: { tags: ["stablecoin-data"], revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error(`DefiLlama API error: ${res.status}`);
  }

  const data: DefiLlamaEntry[] = await res.json();

  return data.map((d) => {
    const ts = parseInt(d.date);
    return {
      timestamp: ts,
      date: new Date(ts * 1000).toISOString().split("T")[0],
      supply: d.totalCirculatingUSD?.peggedUSD ?? 0,
    };
  });
}

/**
 * Fetches USDT + USDC daily circulating supply and merges them
 * into a combined time series.
 */
export async function fetchStablecoinSupply(): Promise<StablecoinDataPoint[]> {
  const [usdt, usdc] = await Promise.all([
    fetchStablecoinChart(1), // USDT
    fetchStablecoinChart(2), // USDC
  ]);

  // Build a map of date → combined supply
  const combined = new Map<string, { timestamp: number; supply: number }>();

  for (const point of usdt) {
    combined.set(point.date, {
      timestamp: point.timestamp,
      supply: point.supply,
    });
  }

  for (const point of usdc) {
    const existing = combined.get(point.date);
    if (existing) {
      existing.supply += point.supply;
    } else {
      combined.set(point.date, {
        timestamp: point.timestamp,
        supply: point.supply,
      });
    }
  }

  // Sort by date and return
  return Array.from(combined.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([date, data]) => ({
      timestamp: data.timestamp,
      date,
      supply: data.supply,
    }));
}

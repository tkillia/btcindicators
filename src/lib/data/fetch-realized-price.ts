interface RealizedPriceEntry {
  theDay: string; // "YYYY-MM-DD"
  unixTs: string;
  realizedPrice: string;
}

export interface RealizedPricePoint {
  date: string;
  timestamp: number;
  realizedPrice: number;
}

export async function fetchRealizedPrice(): Promise<RealizedPricePoint[]> {
  const res = await fetch("https://bitcoin-data.com/v1/realized-price", {
    next: { tags: ["btc-data"], revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`Realized price API: HTTP ${res.status}`);
  }

  const raw: RealizedPriceEntry[] = await res.json();

  return raw
    .map((e) => ({
      date: e.theDay,
      timestamp: parseInt(e.unixTs, 10),
      realizedPrice: parseFloat(e.realizedPrice),
    }))
    .filter((p) => !isNaN(p.realizedPrice) && p.realizedPrice > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

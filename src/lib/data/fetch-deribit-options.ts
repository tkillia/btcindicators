export interface DeribitSummary {
  putCallRatio: number;
  totalOpenInterest: number;
  aggregateIV: number;
  underlyingPrice: number;
}

interface BookSummaryEntry {
  instrument_name: string;
  open_interest: number;
  volume_usd: number;
  mark_iv: number;
  underlying_price: number;
}

/**
 * Fetch current BTC options summary from Deribit.
 * Public API, no auth needed.
 */
export async function fetchDeribitOptionsSummary(): Promise<DeribitSummary> {
  const res = await fetch(
    "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option",
    { next: { tags: ["deribit-data"], revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`Deribit API error: ${res.status}`);

  const json = await res.json();
  const entries: BookSummaryEntry[] = json?.result;

  if (!Array.isArray(entries) || entries.length === 0) {
    return { putCallRatio: 0, totalOpenInterest: 0, aggregateIV: 0, underlyingPrice: 0 };
  }

  let putOI = 0;
  let callOI = 0;
  let totalOI = 0;
  let ivSum = 0;
  let ivCount = 0;
  let underlyingPrice = 0;

  for (const e of entries) {
    const isput = e.instrument_name.endsWith("-P");
    const iscall = e.instrument_name.endsWith("-C");
    const oi = e.open_interest || 0;

    totalOI += oi;
    if (isput) putOI += oi;
    if (iscall) callOI += oi;

    if (e.mark_iv > 0 && oi > 0) {
      ivSum += e.mark_iv * oi;
      ivCount += oi;
    }

    if (e.underlying_price > 0) {
      underlyingPrice = e.underlying_price;
    }
  }

  return {
    putCallRatio: callOI > 0 ? putOI / callOI : 0,
    totalOpenInterest: totalOI,
    aggregateIV: ivCount > 0 ? ivSum / ivCount : 0,
    underlyingPrice,
  };
}

export interface DeribitHistoricalIV {
  timestamp: number;
  date: string;
  iv: number;
}

/**
 * Fetch BTC DVOL (Deribit Volatility Index) historical data.
 * Public API, no auth.
 */
export async function fetchDeribitDVOL(
  days = 365
): Promise<DeribitHistoricalIV[]> {
  const now = Date.now();
  const start = now - days * 86400 * 1000;

  const res = await fetch(
    `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=${start}&end_timestamp=${now}&resolution=86400000`,
    { next: { tags: ["deribit-data"], revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`Deribit DVOL API error: ${res.status}`);

  const json = await res.json();
  const data: number[][] = json?.result?.data;

  if (!Array.isArray(data)) return [];

  return data.map((d) => {
    const ts = Math.floor(d[0] / 1000);
    return {
      timestamp: ts,
      date: new Date(d[0]).toISOString().split("T")[0],
      iv: d[4], // close value of DVOL
    };
  });
}

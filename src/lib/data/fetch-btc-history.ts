import { DailyPrice } from "./types";

interface CryptoCompareResponse {
  Data: {
    Data: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volumefrom: number;
    }>;
  };
}

export async function fetchBtcHistory(): Promise<DailyPrice[]> {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

  const url = apiKey
    ? `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&allData=true&api_key=${apiKey}`
    : `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&allData=true`;

  const res = await fetch(url, {
    next: { tags: ["btc-data"], revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`CryptoCompare API error: ${res.status}`);
  }

  const json: CryptoCompareResponse = await res.json();
  const raw = json.Data.Data;

  return raw
    .filter((d) => d.close > 0)
    .map((d) => ({
      timestamp: d.time,
      date: new Date(d.time * 1000).toISOString().split("T")[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volumefrom,
    }));
}

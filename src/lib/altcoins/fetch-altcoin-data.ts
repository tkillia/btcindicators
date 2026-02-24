import { AltcoinToken, AltcoinScreenerData } from "./types";
import { SYMBOL_TO_GECKO_ID } from "./token-config";
import { computeOiZScore, computeBreakoutScore } from "./compute-metrics";

const COINALYZE_BASE = "https://api.coinalyze.net/v1";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";

const TOP_N = 40;
const OI_HISTORY_DAYS = 30;
const COINALYZE_BATCH = 20; // max symbols per Coinalyze call

// --- Types ---

interface CoinalyzeMarket {
  symbol: string; // e.g. "ETHUSDT_PERP.A"
  base_asset: string;
  is_perpetual: boolean;
  exchange: string;
  has_ohlcv_data: boolean;
}

interface CoinalyzeOI {
  symbol: string;
  value: number; // OI in base asset
}

interface CoinalyzeFunding {
  symbol: string;
  value: number; // funding rate decimal
}

interface CoinalyzeOiHistEntry {
  symbol: string;
  history: Array<{ t: number; o: number; h: number; l: number; c: number }>;
}

interface CoinalyzeOhlcvEntry {
  symbol: string;
  history: Array<{
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
}

interface GeckoMarket {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
}

// --- Coinalyze helpers ---

function coinalyzeHeaders(): Record<string, string> {
  const key = process.env.COINALYZE_API_KEY;
  if (!key) return {};
  return { api_key: key };
}

async function coinalyzeFetch<T>(path: string): Promise<T | null> {
  const key = process.env.COINALYZE_API_KEY;
  if (!key) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${COINALYZE_BASE}${path}`, {
        headers: coinalyzeHeaders(),
        next: { tags: ["altcoin-data"], revalidate: 86400 },
      });
      if (r.status === 429) {
        console.warn(`[coinalyze] 429 rate-limited, waiting ${(attempt + 1) * 3}s`);
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 3000));
        continue;
      }
      if (!r.ok) {
        console.warn(`[coinalyze] HTTP ${r.status} for ${path}`);
        return null;
      }
      return r.json();
    } catch (err) {
      console.warn(`[coinalyze] fetch error for ${path}:`, err);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return null;
}

/** Split array into chunks of size n */
function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n));
  }
  return result;
}

// --- CoinGecko ---

async function fetchCoinGeckoMarkets(
  ids: string[]
): Promise<GeckoMarket[]> {
  if (ids.length === 0) return [];
  const url =
    `${COINGECKO_MARKETS}?vs_currency=usd&ids=${ids.join(",")}&per_page=250` +
    `&order=market_cap_desc&sparkline=false&price_change_percentage=7d`;
  try {
    const r = await fetch(url, {
      next: { tags: ["altcoin-data"], revalidate: 86400 },
    });
    if (!r.ok) {
      console.warn(`[altcoins] CoinGecko: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[altcoins] CoinGecko failed:", err);
    return [];
  }
}

// --- Orchestrator ---

export async function fetchAllAltcoinData(): Promise<AltcoinScreenerData> {
  // Step 1: Fetch Coinalyze markets + CoinGecko in parallel
  const allGeckoIds = [...Object.values(SYMBOL_TO_GECKO_ID), "bitcoin"];
  const [markets, geckoMarkets] = await Promise.all([
    coinalyzeFetch<CoinalyzeMarket[]>("/future-markets"),
    fetchCoinGeckoMarkets(allGeckoIds),
  ]);

  // Build CoinGecko lookup
  const geckoBySymbol = new Map<string, GeckoMarket>();
  let btcChange7d = 0;
  for (const g of geckoMarkets) {
    geckoBySymbol.set(g.symbol.toUpperCase(), g);
    if (g.id === "bitcoin") {
      btcChange7d = g.price_change_percentage_7d_in_currency ?? 0;
    }
  }

  // Filter to aggregated USDT perps that we have CoinGecko data for
  const aggPerps = (markets ?? []).filter(
    (m) =>
      m.exchange === "A" &&
      m.is_perpetual &&
      m.symbol.endsWith("_PERP.A") &&
      m.symbol.includes("USDT")
  );

  // Map: base asset → Coinalyze symbol
  const baseToCoinalyze = new Map<string, string>();
  for (const m of aggPerps) {
    baseToCoinalyze.set(m.base_asset, m.symbol);
  }

  // Pick top N tokens by CoinGecko volume that have Coinalyze futures
  const geckoTokens = geckoMarkets
    .filter(
      (g) =>
        g.id !== "bitcoin" &&
        baseToCoinalyze.has(g.symbol.toUpperCase())
    )
    .sort((a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0))
    .slice(0, TOP_N);

  const selectedBases = geckoTokens.map((g) => g.symbol.toUpperCase());
  const coinalyzeSymbols = selectedBases
    .map((b) => baseToCoinalyze.get(b)!)
    .filter(Boolean);

  // Step 2: Fetch OI, funding, OI history from Coinalyze
  // Process sequentially per batch to stay under 40 req/min rate limit
  const symbolBatches = chunk(coinalyzeSymbols, COINALYZE_BATCH);
  const now = Math.floor(Date.now() / 1000);
  const from = now - OI_HISTORY_DAYS * 86400;

  const oiResults: (CoinalyzeOI[] | null)[] = [];
  const fundingResults: (CoinalyzeFunding[] | null)[] = [];
  const oiHistResults: (CoinalyzeOiHistEntry[] | null)[] = [];
  const ohlcvResults: (CoinalyzeOhlcvEntry[] | null)[] = [];

  // Fetch all Coinalyze data fully sequentially (1.5s gap) to avoid burst rate limits
  const delay = () => new Promise((r) => setTimeout(r, 1500));
  for (const batch of symbolBatches) {
    const syms = batch.join(",");
    const oi = await coinalyzeFetch<CoinalyzeOI[]>(`/open-interest?symbols=${syms}`);
    await delay();
    const funding = await coinalyzeFetch<CoinalyzeFunding[]>(`/funding-rate?symbols=${syms}`);
    await delay();
    const oiHist = await coinalyzeFetch<CoinalyzeOiHistEntry[]>(
      `/open-interest-history?symbols=${syms}&interval=daily&from=${from}&to=${now}`
    );
    await delay();
    const ohlcv = await coinalyzeFetch<CoinalyzeOhlcvEntry[]>(
      `/ohlcv-history?symbols=${syms}&interval=daily&from=${from}&to=${now}`
    );
    await delay();
    oiResults.push(oi);
    fundingResults.push(funding);
    oiHistResults.push(oiHist);
    ohlcvResults.push(ohlcv);
  }

  // Build lookups from Coinalyze results
  const oiMap = new Map<string, number>();
  for (const batch of oiResults) {
    if (!batch) continue;
    for (const item of batch) oiMap.set(item.symbol, item.value);
  }

  const fundingMap = new Map<string, number>();
  for (const batch of fundingResults) {
    if (!batch) continue;
    for (const item of batch) fundingMap.set(item.symbol, item.value);
  }

  const oiHistMap = new Map<string, number[]>();
  for (const batch of oiHistResults) {
    if (!batch) continue;
    for (const item of batch) {
      oiHistMap.set(
        item.symbol,
        item.history.map((h) => h.c)
      );
    }
  }

  const volumeMap = new Map<string, number>();
  for (const batch of ohlcvResults) {
    if (!batch) continue;
    for (const item of batch) {
      // Sum last 24h volume (latest candle)
      const latest = item.history[item.history.length - 1];
      if (latest) volumeMap.set(item.symbol, latest.v);
    }
  }

  // Step 3: Assemble token data
  const tokens: AltcoinToken[] = [];
  for (const gecko of geckoTokens) {
    const base = gecko.symbol.toUpperCase();
    const cSymbol = baseToCoinalyze.get(base);
    if (!cSymbol) continue;

    const price = gecko.current_price ?? 0;
    const priceChange24h = gecko.price_change_percentage_24h ?? 0;
    const priceChange7d =
      gecko.price_change_percentage_7d_in_currency ?? 0;
    const marketCap = gecko.market_cap ?? 0;
    const fdv = gecko.fully_diluted_valuation ?? 0;

    // Coinalyze OI (in base asset) → convert to USD
    const oiBase = oiMap.get(cSymbol) ?? 0;
    const openInterest = oiBase * price;

    // OI history → z-score (in base asset units, z-score is scale-invariant)
    const oiHist = oiHistMap.get(cSymbol) ?? [];
    const oiZScore = computeOiZScore(oiHist);

    // OI 24h change from history
    const prevOi = oiHist.length > 1 ? oiHist[oiHist.length - 2] : 0;
    const currOi = oiHist.length > 0 ? oiHist[oiHist.length - 1] : 0;
    const oiChange24h = prevOi > 0 ? ((currOi - prevOi) / prevOi) * 100 : 0;

    // Funding rate → APR
    const fundingRate = fundingMap.get(cSymbol) ?? 0;
    const fundingApr = fundingRate * 3 * 365 * 100;

    // Futures volume (USD) from Coinalyze, fallback to CoinGecko spot
    const futuresVol = volumeMap.get(cSymbol);
    const volume24h = futuresVol
      ? futuresVol * price
      : gecko.total_volume ?? 0;

    const relativeStrength =
      btcChange7d !== 0 ? priceChange7d / btcChange7d : 0;

    const token: AltcoinToken = {
      symbol: base,
      price,
      priceChange24h,
      priceChange7d,
      volume24h,
      marketCap,
      fdv,
      openInterest,
      oiChange24h,
      oiZScore,
      fundingRate,
      fundingApr,
      relativeStrength,
      breakoutScore: 0,
    };
    token.breakoutScore = computeBreakoutScore(token);
    tokens.push(token);
  }

  tokens.sort((a, b) => b.breakoutScore - a.breakoutScore);

  return {
    tokens,
    btcChange7d,
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}

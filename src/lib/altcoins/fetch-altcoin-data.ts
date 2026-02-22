import { AltcoinToken, AltcoinScreenerData } from "./types";
import { SYMBOL_TO_GECKO_ID, EXCLUDED_SYMBOLS } from "./token-config";
import { computeOiZScore, computeBreakoutScore } from "./compute-metrics";

const BINANCE_FUTURES =
  "https://fapi.binance.com/fapi/v1/ticker/24hr";
const BINANCE_PREMIUM_INDEX =
  "https://fapi.binance.com/fapi/v1/premiumIndex";
const BINANCE_OI_HIST =
  "https://fapi.binance.com/futures/data/openInterestHist";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";

const TOP_N = 40;
const OI_HISTORY_DAYS = 30;

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

interface BinancePremiumIndex {
  symbol: string;
  lastFundingRate: string;
}

interface BinanceOiHistPoint {
  sumOpenInterestValue: string;
  timestamp: number;
}

interface GeckoMarket {
  id: string;
  symbol: string;
  market_cap: number;
  fully_diluted_valuation: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
}

// --- Individual fetchers ---

async function fetchBinanceFuturesTickers(): Promise<BinanceTicker[]> {
  const r = await fetch(BINANCE_FUTURES, {
    next: { tags: ["altcoin-data"], revalidate: 86400 },
  });
  if (!r.ok) throw new Error(`Binance tickers: HTTP ${r.status}`);
  return r.json();
}

async function fetchBinanceFundingRates(): Promise<BinancePremiumIndex[]> {
  const r = await fetch(BINANCE_PREMIUM_INDEX, {
    next: { tags: ["altcoin-data"], revalidate: 86400 },
  });
  if (!r.ok) throw new Error(`Binance premium index: HTTP ${r.status}`);
  return r.json();
}

async function fetchOiHistory(
  symbol: string
): Promise<BinanceOiHistPoint[]> {
  const url = `${BINANCE_OI_HIST}?symbol=${symbol}&period=1d&limit=${OI_HISTORY_DAYS}`;
  try {
    const r = await fetch(url, {
      next: { tags: ["altcoin-data"], revalidate: 86400 },
    });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

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
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

// --- Orchestrator ---

export async function fetchAllAltcoinData(): Promise<AltcoinScreenerData> {
  // Step 1: Batch calls — all tickers + all funding rates
  const [allTickers, allFunding] = await Promise.all([
    fetchBinanceFuturesTickers(),
    fetchBinanceFundingRates(),
  ]);

  // Filter to USDT perps, exclude stablecoins/BTC, sort by volume
  const usdtTickers = allTickers
    .filter(
      (t) => t.symbol.endsWith("USDT") && !EXCLUDED_SYMBOLS.has(t.symbol)
    )
    .sort(
      (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
    )
    .slice(0, TOP_N);

  // Build funding rate lookup
  const fundingMap = new Map<string, number>();
  for (const f of allFunding) {
    fundingMap.set(f.symbol, parseFloat(f.lastFundingRate));
  }

  // Step 2: Resolve CoinGecko IDs for selected tokens
  const symbolToBase = (s: string) => s.replace("USDT", "");
  const geckoIds: string[] = [];
  for (const t of usdtTickers) {
    const base = symbolToBase(t.symbol);
    const geckoId = SYMBOL_TO_GECKO_ID[base];
    if (geckoId) geckoIds.push(geckoId);
  }

  // Step 3: Parallel — OI history for each token + CoinGecko batch
  const [geckoMarkets, ...oiResults] = await Promise.all([
    fetchCoinGeckoMarkets([...geckoIds, "bitcoin"]),
    ...usdtTickers.map((t) => fetchOiHistory(t.symbol)),
  ]);

  // Build CoinGecko lookup by symbol (lowercase)
  const geckoBySymbol = new Map<string, GeckoMarket>();
  let btcChange7d = 0;
  for (const g of geckoMarkets) {
    geckoBySymbol.set(g.symbol.toUpperCase(), g);
    if (g.id === "bitcoin") {
      btcChange7d = g.price_change_percentage_7d_in_currency ?? 0;
    }
  }

  // Step 4: Assemble token data
  const tokens: AltcoinToken[] = [];
  for (let i = 0; i < usdtTickers.length; i++) {
    const ticker = usdtTickers[i];
    const base = symbolToBase(ticker.symbol);
    const oiHist = oiResults[i];
    const gecko = geckoBySymbol.get(base);

    const price = parseFloat(ticker.lastPrice);
    const priceChange24h = parseFloat(ticker.priceChangePercent);
    const volume24h = parseFloat(ticker.quoteVolume);
    const fundingRate = fundingMap.get(ticker.symbol) ?? 0;
    const fundingApr = fundingRate * 3 * 365 * 100; // 8h rate → annual %

    const priceChange7d =
      gecko?.price_change_percentage_7d_in_currency ?? 0;
    const marketCap = gecko?.market_cap ?? 0;
    const fdv = gecko?.fully_diluted_valuation ?? 0;

    // OI metrics
    const oiValues = oiHist.map((p) =>
      parseFloat(p.sumOpenInterestValue)
    );
    const currentOi = oiValues.length > 0 ? oiValues[oiValues.length - 1] : 0;
    const prevOi = oiValues.length > 1 ? oiValues[oiValues.length - 2] : currentOi;
    const oiChange24h = prevOi > 0 ? ((currentOi - prevOi) / prevOi) * 100 : 0;
    const oiZScore = computeOiZScore(oiValues);

    // Relative strength vs BTC
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
      openInterest: currentOi,
      oiChange24h,
      oiZScore,
      fundingRate,
      fundingApr,
      relativeStrength,
      breakoutScore: 0, // computed below
    };
    token.breakoutScore = computeBreakoutScore(token);
    tokens.push(token);
  }

  // Sort by breakout score descending
  tokens.sort((a, b) => b.breakoutScore - a.breakoutScore);

  return {
    tokens,
    btcChange7d,
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}

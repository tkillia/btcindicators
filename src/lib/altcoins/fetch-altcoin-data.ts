import { AltcoinToken, AltcoinScreenerData } from "./types";
import { SYMBOL_TO_GECKO_ID, EXCLUDED_SYMBOLS } from "./token-config";
import { computeOiZScore, computeBreakoutScore } from "./compute-metrics";

const BINANCE_FUTURES_TICKER =
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
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
}

// --- Individual fetchers (all graceful — never throw) ---

async function fetchBinanceFuturesTickers(): Promise<BinanceTicker[]> {
  try {
    const r = await fetch(BINANCE_FUTURES_TICKER, {
      next: { tags: ["altcoin-data"], revalidate: 86400 },
    });
    if (!r.ok) {
      console.warn(`[altcoins] Binance futures tickers: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[altcoins] Binance futures tickers failed:", err);
    return [];
  }
}

async function fetchBinanceFundingRates(): Promise<BinancePremiumIndex[]> {
  try {
    const r = await fetch(BINANCE_PREMIUM_INDEX, {
      next: { tags: ["altcoin-data"], revalidate: 86400 },
    });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
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
    if (!r.ok) {
      console.warn(`[altcoins] CoinGecko markets: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[altcoins] CoinGecko markets failed:", err);
    return [];
  }
}

// --- Orchestrator ---

export async function fetchAllAltcoinData(): Promise<AltcoinScreenerData> {
  // Step 1: Fetch CoinGecko (primary, always works) + Binance futures (may be geo-blocked)
  const allGeckoIds = [...Object.values(SYMBOL_TO_GECKO_ID), "bitcoin"];
  const [geckoMarkets, binanceTickers, binanceFunding] = await Promise.all([
    fetchCoinGeckoMarkets(allGeckoIds),
    fetchBinanceFuturesTickers(),
    fetchBinanceFundingRates(),
  ]);

  const hasBinance = binanceTickers.length > 0;

  // Build Binance lookups
  const binanceByBase = new Map<string, BinanceTicker>();
  if (hasBinance) {
    for (const t of binanceTickers) {
      if (t.symbol.endsWith("USDT") && !EXCLUDED_SYMBOLS.has(t.symbol)) {
        binanceByBase.set(t.symbol.replace("USDT", ""), t);
      }
    }
  }
  const fundingMap = new Map<string, number>();
  for (const f of binanceFunding) {
    fundingMap.set(f.symbol, parseFloat(f.lastFundingRate));
  }

  // Build CoinGecko lookup
  const geckoBySymbol = new Map<string, GeckoMarket>();
  let btcChange7d = 0;
  for (const g of geckoMarkets) {
    geckoBySymbol.set(g.symbol.toUpperCase(), g);
    if (g.id === "bitcoin") {
      btcChange7d = g.price_change_percentage_7d_in_currency ?? 0;
    }
  }

  // Step 2: Build token list from CoinGecko data (always available), enrich with Binance
  // Use CoinGecko as primary source, sorted by volume
  const geckoTokens = geckoMarkets
    .filter((g) => g.id !== "bitcoin")
    .sort((a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0))
    .slice(0, TOP_N);

  // Step 3: Fetch OI history in parallel (graceful — returns [] if Binance is blocked)
  const oiResults = await Promise.all(
    geckoTokens.map((g) => {
      const base = g.symbol.toUpperCase();
      return hasBinance ? fetchOiHistory(`${base}USDT`) : Promise.resolve([]);
    })
  );

  // Step 4: Assemble token data
  const tokens: AltcoinToken[] = [];
  for (let i = 0; i < geckoTokens.length; i++) {
    const gecko = geckoTokens[i];
    const base = gecko.symbol.toUpperCase();
    const binance = binanceByBase.get(base);
    const oiHist = oiResults[i];

    const price = gecko.current_price ?? 0;
    const priceChange24h = gecko.price_change_percentage_24h ?? 0;
    const priceChange7d =
      gecko.price_change_percentage_7d_in_currency ?? 0;
    const volume24h = binance
      ? parseFloat(binance.quoteVolume)
      : gecko.total_volume ?? 0;
    const marketCap = gecko.market_cap ?? 0;
    const fdv = gecko.fully_diluted_valuation ?? 0;

    const fundingRate = fundingMap.get(`${base}USDT`) ?? 0;
    const fundingApr = fundingRate * 3 * 365 * 100;

    // OI metrics
    const oiValues = oiHist.map((p) =>
      parseFloat(p.sumOpenInterestValue)
    );
    const currentOi =
      oiValues.length > 0 ? oiValues[oiValues.length - 1] : 0;
    const prevOi =
      oiValues.length > 1 ? oiValues[oiValues.length - 2] : currentOi;
    const oiChange24h =
      prevOi > 0 ? ((currentOi - prevOi) / prevOi) * 100 : 0;
    const oiZScore = computeOiZScore(oiValues);

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

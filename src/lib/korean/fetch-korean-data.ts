import { KoreanToken, KoreanScreenerData } from "./types";

const UPBIT_BASE = "https://api.upbit.com/v1";
const BITHUMB_ALL = "https://api.bithumb.com/public/ticker/ALL_KRW";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";

// --- Upbit types ---

interface UpbitMarket {
  market: string; // "KRW-BTC"
  english_name: string;
}

interface UpbitTicker {
  market: string;
  trade_price: number;
  acc_trade_price_24h: number; // KRW volume
  acc_trade_volume_24h: number;
  signed_change_rate: number; // 24h change as decimal
}

// --- Bithumb types ---

interface BithumbTickerData {
  closing_price: string;
  units_traded_24H: string;
  acc_trade_value_24H: string;
  fluctate_rate_24H: string;
}

interface BithumbAllResponse {
  status: string;
  data: Record<string, BithumbTickerData | string>;
}

// --- CoinGecko types ---

interface GeckoMarket {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number;
}

// --- Symbol mapping: Upbit base → CoinGecko ID ---
// For tokens commonly listed on Korean exchanges
const UPBIT_TO_GECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  TRX: "tron",
  MATIC: "matic-network",
  SHIB: "shiba-inu",
  ATOM: "cosmos",
  UNI: "uniswap",
  NEAR: "near",
  APT: "aptos",
  SUI: "sui",
  ARB: "arbitrum",
  OP: "optimism",
  FIL: "filecoin",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  ALGO: "algorand",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AAVE: "aave",
  EOS: "eos",
  XLM: "stellar",
  FLOW: "flow",
  IMX: "immutable-x",
  SEI: "sei-network",
  STX: "blockstack",
  INJ: "injective-protocol",
  THETA: "theta-token",
  GRT: "the-graph",
  AXS: "axie-infinity",
  CRV: "curve-dao-token",
  ENS: "ethereum-name-service",
  COMP: "compound-governance-token",
  ZRX: "0x",
  BAT: "basic-attention-token",
  IOTA: "iota",
  QTUM: "qtum",
  NEO: "neo",
  KAVA: "kava",
  ONT: "ontology",
  ZIL: "zilliqa",
  ICX: "icon",
  STORJ: "storj",
  SNX: "havven",
};

// --- Fetch helpers ---

async function fetchUpbitMarkets(): Promise<UpbitMarket[]> {
  try {
    const r = await fetch(`${UPBIT_BASE}/market/all?is_details=false`, {
      next: { tags: ["korean-data"], revalidate: 86400 },
    });
    if (!r.ok) {
      console.warn(`[korean] Upbit markets: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[korean] Upbit markets failed:", err);
    return [];
  }
}

async function fetchUpbitTickers(
  marketCodes: string[]
): Promise<UpbitTicker[]> {
  if (marketCodes.length === 0) return [];
  try {
    const r = await fetch(
      `${UPBIT_BASE}/ticker?markets=${marketCodes.join(",")}`,
      { next: { tags: ["korean-data"], revalidate: 86400 } }
    );
    if (!r.ok) {
      console.warn(`[korean] Upbit tickers: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[korean] Upbit tickers failed:", err);
    return [];
  }
}

async function fetchBithumbAll(): Promise<
  Map<string, { price: number; volume24h: number }>
> {
  const result = new Map<string, { price: number; volume24h: number }>();
  try {
    const r = await fetch(BITHUMB_ALL, {
      next: { tags: ["korean-data"], revalidate: 86400 },
    });
    if (!r.ok) {
      console.warn(`[korean] Bithumb: HTTP ${r.status}`);
      return result;
    }
    const json: BithumbAllResponse = await r.json();
    if (json.status !== "0000") return result;
    for (const [key, val] of Object.entries(json.data)) {
      if (key === "date" || typeof val === "string") continue;
      const ticker = val as BithumbTickerData;
      result.set(key, {
        price: parseFloat(ticker.closing_price) || 0,
        volume24h: parseFloat(ticker.acc_trade_value_24H) || 0,
      });
    }
  } catch (err) {
    console.warn("[korean] Bithumb failed:", err);
  }
  return result;
}

async function fetchGeckoMarkets(ids: string[]): Promise<GeckoMarket[]> {
  if (ids.length === 0) return [];
  const url =
    `${COINGECKO_MARKETS}?vs_currency=usd&ids=${ids.join(",")}&per_page=250` +
    `&order=market_cap_desc&sparkline=false`;
  try {
    const r = await fetch(url, {
      next: { tags: ["korean-data"], revalidate: 86400 },
    });
    if (!r.ok) {
      console.warn(`[korean] CoinGecko: HTTP ${r.status}`);
      return [];
    }
    return r.json();
  } catch (err) {
    console.warn("[korean] CoinGecko failed:", err);
    return [];
  }
}

// --- Orchestrator ---

export async function fetchKoreanData(): Promise<KoreanScreenerData> {
  // Step 1: Fetch Upbit markets, Bithumb, and CoinGecko in parallel
  const geckoIds = Object.values(UPBIT_TO_GECKO);

  const [upbitMarkets, bithumbMap, geckoMarkets] = await Promise.all([
    fetchUpbitMarkets(),
    fetchBithumbAll(),
    fetchGeckoMarkets(geckoIds),
  ]);

  // Filter to KRW markets that we have in our mapping
  const krwMarkets = upbitMarkets.filter(
    (m) =>
      m.market.startsWith("KRW-") &&
      UPBIT_TO_GECKO[m.market.replace("KRW-", "")]
  );

  const marketCodes = krwMarkets.map((m) => m.market);

  // Step 2: Fetch Upbit tickers for all KRW pairs
  const upbitTickers = await fetchUpbitTickers(marketCodes);

  // Build lookups
  const upbitBySymbol = new Map<string, UpbitTicker>();
  for (const t of upbitTickers) {
    const sym = t.market.replace("KRW-", "");
    upbitBySymbol.set(sym, t);
  }

  const upbitNameMap = new Map<string, string>();
  for (const m of krwMarkets) {
    upbitNameMap.set(m.market.replace("KRW-", ""), m.english_name);
  }

  const geckoBySymbol = new Map<string, GeckoMarket>();
  for (const g of geckoMarkets) {
    geckoBySymbol.set(g.symbol.toUpperCase(), g);
  }

  // Step 3: Calculate implied KRW/USD from BTC
  const btcUpbit = upbitBySymbol.get("BTC");
  const btcGecko = geckoBySymbol.get("BTC");
  const btcKrw = btcUpbit?.trade_price ?? 0;
  const btcUsd = btcGecko?.current_price ?? 0;
  const impliedKrwUsd = btcUsd > 0 ? btcKrw / btcUsd : 1450; // fallback

  // BTC's own absolute premium (vs an assumed ~1450 KRW/USD baseline)
  const BASELINE_KRW_USD = 1450;
  const btcKimchiPremium =
    btcUsd > 0
      ? ((btcKrw / BASELINE_KRW_USD / btcUsd) - 1) * 100
      : 0;

  // Step 4: Assemble tokens
  const tokens: KoreanToken[] = [];

  for (const sym of Object.keys(UPBIT_TO_GECKO)) {
    if (sym === "BTC") continue; // skip BTC itself

    const upbit = upbitBySymbol.get(sym);
    const gecko = geckoBySymbol.get(sym);
    if (!upbit || !gecko) continue;

    const krwPrice = upbit.trade_price;
    const usdPrice = gecko.current_price;

    // Kimchi premium relative to BTC (removes baseline FX)
    // premium = (ALT_KRW / ALT_USD) / (BTC_KRW / BTC_USD) - 1
    const kimchiPremium =
      usdPrice > 0 && btcKrw > 0 && btcUsd > 0
        ? ((krwPrice / usdPrice / impliedKrwUsd) - 1) * 100
        : 0;

    const upbitVol = upbit.acc_trade_price_24h ?? 0;
    const bithumbData = bithumbMap.get(sym);
    const bithumbVol = bithumbData?.volume24h ?? 0;

    const totalKrwVol = upbitVol + bithumbVol;
    const marketCap = gecko.market_cap ?? 0;

    // Volume-to-mcap: convert KRW vol to USD, then divide by mcap
    const volUsd = totalKrwVol / impliedKrwUsd;
    const volumeToMcap = marketCap > 0 ? volUsd / marketCap : 0;

    tokens.push({
      symbol: sym,
      name: upbitNameMap.get(sym) ?? sym,
      krwPrice,
      usdPrice,
      kimchiPremium,
      upbitVolume24h: upbitVol,
      bithumbVolume24h: bithumbVol,
      totalKrwVolume: totalKrwVol,
      priceChange24h: (upbit.signed_change_rate ?? 0) * 100,
      marketCap,
      volumeToMcap,
    });
  }

  // Sort by total KRW volume descending
  tokens.sort((a, b) => b.totalKrwVolume - a.totalKrwVolume);

  return {
    tokens,
    btcKimchiPremium,
    impliedKrwUsd,
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}

export interface KoreanToken {
  symbol: string; // e.g. "ETH"
  name: string;
  krwPrice: number; // Upbit KRW price
  usdPrice: number; // CoinGecko USD price
  kimchiPremium: number; // % premium vs global price
  upbitVolume24h: number; // KRW volume on Upbit
  bithumbVolume24h: number; // KRW volume on Bithumb
  totalKrwVolume: number; // combined KRW volume
  priceChange24h: number; // % from Upbit
  marketCap: number; // USD from CoinGecko
  volumeToMcap: number; // KRW vol / mcap ratio (Korean interest intensity)
}

export interface KoreanScreenerData {
  tokens: KoreanToken[];
  btcKimchiPremium: number; // BTC's own premium (baseline)
  impliedKrwUsd: number; // derived from BTC
  lastUpdated: string;
}

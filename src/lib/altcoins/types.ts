export interface AltcoinToken {
  symbol: string; // e.g. "ETH"
  price: number;
  priceChange24h: number; // %
  priceChange7d: number; // %
  volume24h: number; // USD
  marketCap: number;
  fdv: number;
  openInterest: number; // USD, aggregated across exchanges
  oiChange24h: number; // %
  oiZScore: number; // vs 30d mean/stddev
  fundingRate: number; // per 8h
  fundingApr: number; // annualized %
  relativeStrength: number; // vs BTC 7d
  breakoutScore: number; // composite ranking
}

export interface AltcoinScreenerData {
  tokens: AltcoinToken[];
  btcChange7d: number;
  lastUpdated: string; // ISO date
}

import { DailyPrice } from "../data/types";
import { fetchMiningCost } from "../data/fetch-mining-data";
import { fetchStablecoinSupply } from "../data/fetch-stablecoin-supply";
import {
  fetchBinancePrices,
  fetchCoinbasePrices,
} from "../data/fetch-exchange-prices";
import { fetchBitfinexLongs } from "../data/fetch-bitfinex-longs";
import {
  fetchDeribitDVOL,
  fetchDeribitOptionsSummary,
} from "../data/fetch-deribit-options";
import { sma } from "../utils/moving-average";
import { formatDate, formatPercent, formatCurrency } from "../utils/format";
import { Indicator, IndicatorResult, ChartBar, ChartMarker } from "./types";

// Signal thresholds (same as individual indicators)
const MAYER_BUY = 0.8;
const MAYER_SELL = 2.4;
const WMA_SELL_RATIO = 3;
const MINING_BUY_RATIO = 1.2;
const MINING_SELL_RATIO = 3;
const STABLE_BUY_ROC = 3;
const STABLE_SELL_ROC = -1;
const GAP_BUY = 0.1;
const GAP_SELL = -0.05;
const LONGS_BUY_ROC = 10;
const LONGS_SELL_ROC = -10;
const DVOL_BUY = 60;
const DVOL_SELL = 40;
const PCR_BUY = 0.7; // P/C ratio thresholds (used for live day only)
const PCR_SELL = 0.4;

// Composite thresholds
const COMPOSITE_BUY = 2;
const COMPOSITE_SELL = -2;
const BACKTEST_BUY = 2;
const BACKTEST_SELL = -2;
const BACKTEST_COOLDOWN = 60;

const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;

const HALVING_DATES = [
  "2012-11-28",
  "2016-07-09",
  "2020-05-11",
  "2024-04-20",
];

interface DailyComposite {
  date: string;
  price: number;
  score: number;
  available: number;
}

export class CycleComposite implements Indicator {
  id = "cycle-composite";
  name = "Cycle Composite";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    // 1. Fetch all external data in parallel
    const [miningR, stablecoinR, binanceR, coinbaseR, bitfinexR, dvolR, pcrR] =
      await Promise.allSettled([
        fetchMiningCost(),
        fetchStablecoinSupply(),
        fetchBinancePrices(1000),
        fetchCoinbasePrices(1000),
        fetchBitfinexLongs(1825),
        fetchDeribitDVOL(730),
        fetchDeribitOptionsSummary(),
      ]);

    const miningData =
      miningR.status === "fulfilled" ? miningR.value : [];
    const stablecoinData =
      stablecoinR.status === "fulfilled" ? stablecoinR.value : [];
    const binanceData =
      binanceR.status === "fulfilled" ? binanceR.value : [];
    const coinbaseData =
      coinbaseR.status === "fulfilled" ? coinbaseR.value : [];
    const bitfinexData =
      bitfinexR.status === "fulfilled" ? bitfinexR.value : [];
    const dvolData =
      dvolR.status === "fulfilled" ? dvolR.value : [];
    const livePcr =
      pcrR.status === "fulfilled" ? pcrR.value.putCallRatio : null;

    // 2. Build per-date signal maps
    const mayerSignals = computeMayerSignals(prices);
    const wmaSignals = computeWmaSignals(prices);
    const miningSignals = computeMiningSignals(miningData, prices);
    const stablecoinSignals = computeStablecoinSignals(stablecoinData);
    const gapSignals = computeGapSignals(binanceData, coinbaseData);
    const longsSignals = computeLongsSignals(bitfinexData);
    const dvolSignals = computeDvolSignals(dvolData);

    // Override the most recent day's DVOL signal with live P/C ratio
    // (DVOL is a proxy; P/C ratio is the real sentiment gauge but has no history)
    if (livePcr !== null && dvolData.length > 0) {
      const lastDate = dvolData[dvolData.length - 1].date;
      const pcrSignal =
        livePcr >= PCR_BUY ? 1 : livePcr <= PCR_SELL ? -1 : 0;
      dvolSignals.set(lastDate, pcrSignal);
    }

    const allMaps = [
      mayerSignals,
      wmaSignals,
      miningSignals,
      stablecoinSignals,
      gapSignals,
      longsSignals,
      dvolSignals,
    ];

    // 3. Merge into daily composite
    const composite: DailyComposite[] = [];
    for (const p of prices) {
      let score = 0;
      let available = 0;
      for (const map of allMaps) {
        const signal = map.get(p.date);
        if (signal !== undefined) {
          score += signal;
          available++;
        }
      }
      if (available > 0) {
        composite.push({
          date: p.date,
          price: p.close,
          score,
          available,
        });
      }
    }

    if (composite.length === 0) {
      return this.emptyResult();
    }

    // 4. Build chart data
    const priceLine = {
      label: "BTC Price",
      color: "#e4e4e7",
      data: composite.map((d) => ({ time: d.date, value: d.price })),
    };

    const bars: ChartBar[] = composite.map((d) => ({
      time: d.date,
      value: d.score,
      color: getCompositeColor(d.score),
    }));

    // Build halving markers (only those within chart range)
    const firstDate = composite[0].date;
    const lastDate = composite[composite.length - 1].date;
    const halvingMarkers: ChartMarker[] = HALVING_DATES
      .filter((d) => d >= firstDate && d <= lastDate)
      .map((d, i) => ({
        time: d,
        label: `H${i + 1}`,
        color: "#eab308",
      }));

    // 5. Build backtest
    const backtestRows = buildCompositeBacktest(composite, prices);

    // 6. Current state + cycle position
    const latest = composite[composite.length - 1];
    const signal =
      latest.score >= COMPOSITE_BUY
        ? "buy"
        : latest.score <= COMPOSITE_SELL
          ? "sell"
          : ("neutral" as const);

    const scoreLabel = `${latest.score >= 0 ? "+" : ""}${latest.score}`;
    const cycleInfo = getCyclePosition(latest.date);

    return {
      id: this.id,
      name: this.name,
      description: `${latest.available} indicators · ${cycleInfo}`,
      currentValue: latest.score,
      currentValueLabel: `${scoreLabel} / ${latest.available}`,
      signal,
      signalRules: `Sum of 7 signals (+1 buy, 0 neutral, -1 sell) · Buy ≥${COMPOSITE_BUY} · Sell ≤${COMPOSITE_SELL}`,
      chartData: {
        lines: [priceLine],
        bars,
        markers: halvingMarkers,
      },
      chartConfig: { type: "line+histogram", logScale: true },
      backtestTitle: `Extreme composite readings (≥${BACKTEST_BUY} buy, ≤${BACKTEST_SELL} sell)`,
      backtestColumns: [
        "Date",
        "Type",
        "Score",
        "Indicators",
        "BTC Price",
        "1mo",
        "3mo",
        "6mo",
      ],
      backtestRows,
    };
  }

  private emptyResult(): IndicatorResult {
    return {
      id: this.id,
      name: this.name,
      description: "Aggregating indicators into a single cycle score",
      currentValue: 0,
      currentValueLabel: "N/A",
      signal: "neutral",
      signalRules: "No data available",
      chartData: {},
      chartConfig: { type: "line" },
      backtestTitle: "No data",
      backtestColumns: [],
      backtestRows: [],
    };
  }
}

// --- Sub-indicator signal computations ---

function computeMayerSignals(prices: DailyPrice[]): Map<string, number> {
  const closes = prices.map((p) => p.close);
  const sma200 = sma(closes, 200);
  const signals = new Map<string, number>();

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(sma200[i]) || sma200[i] === 0) continue;
    const mayer = closes[i] / sma200[i];
    if (mayer < MAYER_BUY) signals.set(prices[i].date, 1);
    else if (mayer > MAYER_SELL) signals.set(prices[i].date, -1);
    else signals.set(prices[i].date, 0);
  }
  return signals;
}

function computeWmaSignals(prices: DailyPrice[]): Map<string, number> {
  // Resample to weekly
  const weekly: Array<{ date: string; close: number }> = [];
  let currentWeek = -1;
  for (const p of prices) {
    const week = Math.floor(p.timestamp / SECONDS_PER_WEEK);
    if (week !== currentWeek) {
      weekly.push({ date: p.date, close: p.close });
      currentWeek = week;
    } else {
      weekly[weekly.length - 1] = { date: p.date, close: p.close };
    }
  }

  const weeklyCloses = weekly.map((w) => w.close);
  const wma200 = sma(weeklyCloses, 200);

  // Build weekly WMA lookup (date → wma value)
  const weeklyWmaByDate = new Map<string, number>();
  for (let i = 0; i < weekly.length; i++) {
    if (!isNaN(wma200[i])) {
      weeklyWmaByDate.set(weekly[i].date, wma200[i]);
    }
  }

  // Map daily dates to the most recent weekly WMA
  const signals = new Map<string, number>();
  let lastWma = NaN;
  let weekIdx = 0;

  for (const p of prices) {
    // Advance weekly pointer
    while (
      weekIdx < weekly.length &&
      weekly[weekIdx].date <= p.date
    ) {
      const wma = weeklyWmaByDate.get(weekly[weekIdx].date);
      if (wma !== undefined) lastWma = wma;
      weekIdx++;
    }

    if (isNaN(lastWma)) continue;

    const ratio = p.close / lastWma;
    if (ratio <= 1) signals.set(p.date, 1);
    else if (ratio > WMA_SELL_RATIO) signals.set(p.date, -1);
    else signals.set(p.date, 0);
  }
  return signals;
}

function computeMiningSignals(
  miningData: Array<{
    date: string;
    estimatedCost: number;
  }>,
  prices: DailyPrice[]
): Map<string, number> {
  const signals = new Map<string, number>();
  if (miningData.length === 0) return signals;

  const costByDate = new Map(
    miningData.map((m) => [m.date, m.estimatedCost])
  );

  // Mining data may be sampled; interpolate to daily
  let lastCost = 0;
  for (const p of prices) {
    const cost = costByDate.get(p.date);
    if (cost !== undefined && cost > 0) lastCost = cost;
    if (lastCost <= 0) continue;

    const ratio = p.close / lastCost;
    if (ratio <= MINING_BUY_RATIO) signals.set(p.date, 1);
    else if (ratio >= MINING_SELL_RATIO) signals.set(p.date, -1);
    else signals.set(p.date, 0);
  }
  return signals;
}

function computeStablecoinSignals(
  data: Array<{ date: string; supply: number }>
): Map<string, number> {
  const signals = new Map<string, number>();
  if (data.length < 31) return signals;

  const supplies = data.map((d) => d.supply);

  for (let i = 30; i < data.length; i++) {
    if (supplies[i - 30] <= 0) continue;
    const roc = ((supplies[i] - supplies[i - 30]) / supplies[i - 30]) * 100;
    if (roc > STABLE_BUY_ROC) signals.set(data[i].date, 1);
    else if (roc < STABLE_SELL_ROC) signals.set(data[i].date, -1);
    else signals.set(data[i].date, 0);
  }
  return signals;
}

function computeGapSignals(
  binance: Array<{ date: string; close: number }>,
  coinbase: Array<{ date: string; close: number }>
): Map<string, number> {
  const signals = new Map<string, number>();
  if (binance.length === 0 || coinbase.length === 0) return signals;

  const coinbaseByDate = new Map(coinbase.map((c) => [c.date, c.close]));

  for (const b of binance) {
    const cb = coinbaseByDate.get(b.date);
    if (!cb || b.close <= 0) continue;
    const gap = ((cb - b.close) / b.close) * 100;
    if (gap > GAP_BUY) signals.set(b.date, 1);
    else if (gap < GAP_SELL) signals.set(b.date, -1);
    else signals.set(b.date, 0);
  }
  return signals;
}

function computeLongsSignals(
  data: Array<{ date: string; longs: number }>
): Map<string, number> {
  const signals = new Map<string, number>();
  if (data.length < 31) return signals;

  for (let i = 30; i < data.length; i++) {
    const prev = data[i - 30].longs;
    if (prev <= 0) continue;
    const roc = ((data[i].longs - prev) / prev) * 100;
    if (roc > LONGS_BUY_ROC) signals.set(data[i].date, 1);
    else if (roc < LONGS_SELL_ROC) signals.set(data[i].date, -1);
    else signals.set(data[i].date, 0);
  }
  return signals;
}

function computeDvolSignals(
  data: Array<{ date: string; iv: number }>
): Map<string, number> {
  const signals = new Map<string, number>();
  for (const d of data) {
    if (d.iv > DVOL_BUY) signals.set(d.date, 1);
    else if (d.iv < DVOL_SELL) signals.set(d.date, -1);
    else signals.set(d.date, 0);
  }
  return signals;
}

// --- Color mapping ---

function getCompositeColor(score: number): string {
  if (score >= 3) return "#15803d";  // deep green
  if (score >= 2) return "#22c55e";  // green
  if (score >= 1) return "#86efac";  // light green
  if (score === 0) return "#71717a"; // gray
  if (score >= -1) return "#fca5a5"; // light red
  if (score >= -2) return "#ef4444"; // red
  return "#991b1b";                  // deep red
}

// --- Cycle position ---

function getCyclePosition(dateStr: string): string {
  const date = new Date(dateStr);
  // Find the most recent halving before this date
  let lastHalving = "";
  let cycleNum = 1;
  for (const h of HALVING_DATES) {
    if (h <= dateStr) {
      lastHalving = h;
      cycleNum++;
    }
  }
  if (!lastHalving) return "Pre-halving era";
  const halvingDate = new Date(lastHalving);
  const daysSince = Math.floor(
    (date.getTime() - halvingDate.getTime()) / (86400 * 1000)
  );
  return `Day ${daysSince} of Cycle ${cycleNum} (since ${lastHalving.slice(0, 4)} halving)`;
}

// --- Backtest ---

function buildCompositeBacktest(
  composite: DailyComposite[],
  prices: DailyPrice[]
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  const priceByDate = new Map(prices.map((p, i) => [p.date, i]));
  let lastTrigger = -Infinity;

  for (let i = 0; i < composite.length; i++) {
    if (i - lastTrigger < BACKTEST_COOLDOWN) continue;
    const d = composite[i];

    const isBuy = d.score >= BACKTEST_BUY;
    const isSell = d.score <= BACKTEST_SELL;
    if (!isBuy && !isSell) continue;

    const priceIdx = priceByDate.get(d.date);
    if (priceIdx === undefined) continue;

    const ret1m = lookAhead(prices, priceIdx, 30);
    const ret3m = lookAhead(prices, priceIdx, 90);
    const ret6m = lookAhead(prices, priceIdx, 180);

    rows.push({
      date: formatDate(d.date),
      type: isBuy ? "BUY" : "SELL",
      score: `${d.score >= 0 ? "+" : ""}${d.score}`,
      indicators: `${d.available}/7`,
      btcPrice: formatCurrency(Math.round(d.price)),
      ret1m: isNaN(ret1m) ? "?" : formatPercent(ret1m),
      ret3m: isNaN(ret3m) ? "?" : formatPercent(ret3m),
      ret6m: isNaN(ret6m) ? "?" : formatPercent(ret6m),
    });

    lastTrigger = i;
  }

  // Always show current state as last row
  const latest = composite[composite.length - 1];
  rows.push({
    date: formatDate(latest.date),
    type:
      latest.score >= BACKTEST_BUY
        ? "BUY"
        : latest.score <= BACKTEST_SELL
          ? "SELL"
          : "NOW",
    score: `${latest.score >= 0 ? "+" : ""}${latest.score}`,
    indicators: `${latest.available}/7`,
    btcPrice: formatCurrency(Math.round(latest.price)),
    ret1m: "—",
    ret3m: "—",
    ret6m: "—",
  });

  return rows;
}

function lookAhead(
  prices: DailyPrice[],
  fromIdx: number,
  days: number
): number {
  const targetIdx = fromIdx + days;
  if (targetIdx >= prices.length) return NaN;
  return (
    ((prices[targetIdx].close - prices[fromIdx].close) /
      prices[fromIdx].close) *
    100
  );
}

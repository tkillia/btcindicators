import { DailyPrice } from "../data/types";
import {
  fetchBinancePrices,
  fetchCoinbasePrices,
} from "../data/fetch-exchange-prices";
import { sma } from "../utils/moving-average";
import { formatDate, formatPercent } from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

// Coinbase premium thresholds (percentage)
const BULLISH_THRESHOLD = 0.1;
const BEARISH_THRESHOLD = -0.05;
const BACKTEST_THRESHOLD = 0.2;
const BACKTEST_COOLDOWN = 14; // days

interface GapDataPoint {
  date: string;
  gap: number; // percentage
  binanceClose: number;
  coinbaseClose: number;
}

export class BinanceCoinbaseGap implements Indicator {
  id = "binance-coinbase-gap";
  name = "Binance–Coinbase Gap";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const [binance, coinbase] = await Promise.all([
      fetchBinancePrices(1000),
      fetchCoinbasePrices(1000),
    ]);

    // Build Coinbase lookup by date
    const coinbaseByDate = new Map(coinbase.map((c) => [c.date, c.close]));

    // Align data: only dates present in both
    const aligned: GapDataPoint[] = [];
    for (const b of binance) {
      const cbPrice = coinbaseByDate.get(b.date);
      if (cbPrice && b.close > 0) {
        aligned.push({
          date: b.date,
          gap: ((cbPrice - b.close) / b.close) * 100,
          binanceClose: b.close,
          coinbaseClose: cbPrice,
        });
      }
    }

    if (aligned.length === 0) {
      return this.emptyResult();
    }

    const gaps = aligned.map((d) => d.gap);
    const sma7 = sma(gaps, 7);
    const currentGap = gaps[gaps.length - 1];

    // Signal
    let signal: "buy" | "neutral" | "sell";
    if (currentGap > BULLISH_THRESHOLD) signal = "buy";
    else if (currentGap < BEARISH_THRESHOLD) signal = "sell";
    else signal = "neutral";

    // Chart: gap % line + 7-day SMA
    const gapLine: Array<{ time: string; value: number }> = [];
    const smaLine: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < aligned.length; i++) {
      gapLine.push({ time: aligned[i].date, value: aligned[i].gap });
      if (!isNaN(sma7[i])) {
        smaLine.push({ time: aligned[i].date, value: sma7[i] });
      }
    }

    // Backtest: BTC price lookup
    const btcByDate = new Map(prices.map((p) => [p.date, p.close]));

    // Backtest: every time Coinbase premium exceeded BACKTEST_THRESHOLD%
    const backtestRows: Record<string, string | number>[] = [];
    let lastTrigger = -Infinity;

    for (let i = 0; i < aligned.length; i++) {
      if (i - lastTrigger < BACKTEST_COOLDOWN) continue;
      if (aligned[i].gap < BACKTEST_THRESHOLD) continue;

      const btcPrice = btcByDate.get(aligned[i].date);
      if (!btcPrice) continue;

      // Look ahead 30 and 90 days for BTC return
      const d30 = findDateOffset(prices, aligned[i].date, 30);
      const d90 = findDateOffset(prices, aligned[i].date, 90);

      const ret30 = d30
        ? ((d30 - btcPrice) / btcPrice) * 100
        : NaN;
      const ret90 = d90
        ? ((d90 - btcPrice) / btcPrice) * 100
        : NaN;

      backtestRows.push({
        date: formatDate(aligned[i].date),
        gap: `${aligned[i].gap.toFixed(2)}%`,
        btcPrice: `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        ret30: isNaN(ret30) ? "?" : formatPercent(ret30),
        ret90: isNaN(ret90) ? "?" : formatPercent(ret90),
      });

      lastTrigger = i;
    }

    return {
      id: this.id,
      name: this.name,
      description: "Coinbase premium over Binance (US institutional demand)",
      currentValue: currentGap,
      currentValueLabel: `${currentGap >= 0 ? "+" : ""}${currentGap.toFixed(3)}%`,
      signal,
      signalRules: `CB premium >${BULLISH_THRESHOLD}% = institutional buying · <${BEARISH_THRESHOLD}% = offshore led`,
      chartData: {
        lines: [
          { label: "Gap %", color: "#3b82f6", data: gapLine },
          { label: "7-day SMA", color: "#f59e0b", data: smaLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: false },
      backtestTitle: `Every time CB premium ≥ ${BACKTEST_THRESHOLD}%`,
      backtestColumns: ["Date", "Gap", "BTC Price", "1mo Return", "3mo Return"],
      backtestRows: backtestRows,
    };
  }

  private emptyResult(): IndicatorResult {
    return {
      id: this.id,
      name: this.name,
      description: "Coinbase premium over Binance",
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

function findDateOffset(
  prices: DailyPrice[],
  startDate: string,
  daysAhead: number
): number | null {
  const startIdx = prices.findIndex((p) => p.date === startDate);
  if (startIdx === -1) return null;
  const targetIdx = startIdx + daysAhead;
  if (targetIdx >= prices.length) return null;
  return prices[targetIdx].close;
}

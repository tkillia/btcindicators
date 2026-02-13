import { DailyPrice } from "../data/types";
import { runBacktest } from "../backtest/engine";
import { sma } from "../utils/moving-average";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
} from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

const SMA_PERIOD = 200;
const BUY_THRESHOLD = 0.8;
const SELL_THRESHOLD = 2.4;
const BACKTEST_THRESHOLD = 0.6;

function getSignal(value: number): "buy" | "neutral" | "sell" {
  if (value < BUY_THRESHOLD) return "buy";
  if (value > SELL_THRESHOLD) return "sell";
  return "neutral";
}

function getBarColor(value: number): string {
  if (value < BUY_THRESHOLD) return "#22c55e";
  if (value > SELL_THRESHOLD) return "#ef4444";
  return "#eab308";
}

export class MayerMultiple implements Indicator {
  id = "mayer-multiple";
  name = "Mayer Multiple";

  calculate(prices: DailyPrice[]): IndicatorResult {
    const closes = prices.map((p) => p.close);
    const sma200 = sma(closes, SMA_PERIOD);

    // Compute Mayer Multiple for each day
    const mayerValues = closes.map((close, i) =>
      isNaN(sma200[i]) ? NaN : close / sma200[i]
    );

    const currentMayer = mayerValues[mayerValues.length - 1];

    // Build yearly bar chart: peak Mayer Multiple per year
    const yearlyData = new Map<number, number[]>();
    for (let i = 0; i < prices.length; i++) {
      if (isNaN(mayerValues[i])) continue;
      const year = new Date(prices[i].timestamp * 1000).getUTCFullYear();
      if (!yearlyData.has(year)) yearlyData.set(year, []);
      yearlyData.get(year)!.push(mayerValues[i]);
    }

    const bars = Array.from(yearlyData.entries()).map(([year, values]) => {
      const peak = Math.max(...values);
      return {
        time: `${year}-06-01`,
        value: peak,
        color: getBarColor(peak),
      };
    });

    // Backtest: every time Mayer <= 0.6
    const backtest = runBacktest(prices, mayerValues, {
      title: `Every time Mayer ≤ ${BACKTEST_THRESHOLD}`,
      columns: [
        { key: "date", label: "Date" },
        { key: "price", label: "Price" },
        { key: "mayer", label: "Mayer" },
        { key: "return6m", label: "6mo Return" },
        { key: "return12m", label: "12mo Return" },
      ],
      trigger: (prices, i, computed) => {
        if (isNaN(computed[i]) || computed[i] > BACKTEST_THRESHOLD) return null;
        return {
          date: formatDate(prices[i].date),
          price: formatCurrency(prices[i].close),
          mayer: formatNumber(computed[i]),
        };
      },
      enrich: (row, triggerIndex, prices) => {
        const i6m = triggerIndex + 180;
        const i12m = triggerIndex + 365;
        const currentPrice = prices[triggerIndex].close;

        const return6m =
          i6m < prices.length
            ? ((prices[i6m].close - currentPrice) / currentPrice) * 100
            : NaN;
        const return12m =
          i12m < prices.length
            ? ((prices[i12m].close - currentPrice) / currentPrice) * 100
            : NaN;

        return {
          ...row,
          return6m: isNaN(return6m) ? "?" : formatPercent(return6m),
          return12m: isNaN(return12m) ? "?" : formatPercent(return12m),
        };
      },
      cooldownDays: 60,
    });

    return {
      id: this.id,
      name: this.name,
      description: "Distance from 200-day moving average",
      currentValue: currentMayer,
      currentValueLabel: formatNumber(currentMayer),
      signal: getSignal(currentMayer),
      signalRules: `Buy <${BUY_THRESHOLD} · Normal ${BUY_THRESHOLD}–${SELL_THRESHOLD} · Sell >${SELL_THRESHOLD}`,
      chartData: { bars },
      chartConfig: { type: "bar" },
      backtestTitle: backtest.title,
      backtestColumns: backtest.columns,
      backtestRows: backtest.rows,
    };
  }
}

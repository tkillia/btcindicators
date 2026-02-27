import { DailyPrice } from "../data/types";
import { fetchRealizedPrice, RealizedPricePoint } from "../data/fetch-realized-price";
import { runBacktest } from "../backtest/engine";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatNumber,
} from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

// Signal thresholds based on MVRV (price / realized price)
const BUY_THRESHOLD = 1.0; // at or below realized price = deep value
const SELL_THRESHOLD = 3.5; // 3.5x realized price = overheated
const BACKTEST_TRIGGER = 1.2; // trigger backtest when MVRV drops below 1.2

function getSignal(mvrv: number): "buy" | "neutral" | "sell" {
  if (mvrv <= BUY_THRESHOLD) return "buy";
  if (mvrv >= SELL_THRESHOLD) return "sell";
  return "neutral";
}

export class RealizedPrice implements Indicator {
  id = "realized-price";
  name = "Realized Price";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const realizedData = await fetchRealizedPrice();

    // Build a date → realized price lookup
    const realizedByDate = new Map<string, number>();
    for (const rp of realizedData) {
      realizedByDate.set(rp.date, rp.realizedPrice);
    }

    // Align realized price to BTC price history
    const aligned: number[] = [];
    let lastKnown = 0;
    for (const p of prices) {
      const rp = realizedByDate.get(p.date);
      if (rp !== undefined) lastKnown = rp;
      aligned.push(lastKnown);
    }

    // MVRV = price / realized price
    const mvrv = prices.map((p, i) =>
      aligned[i] > 0 ? p.close / aligned[i] : NaN
    );

    const currentMvrv = mvrv[mvrv.length - 1];
    const currentRealized = aligned[aligned.length - 1];

    // Chart: BTC price + realized price (log scale)
    const priceLine: Array<{ time: string; value: number }> = [];
    const realizedLine: Array<{ time: string; value: number }> = [];

    // Sample weekly to keep chart data manageable
    for (let i = 0; i < prices.length; i += 7) {
      if (prices[i].close > 0) {
        priceLine.push({ time: prices[i].date, value: prices[i].close });
      }
      if (aligned[i] > 0) {
        realizedLine.push({ time: prices[i].date, value: aligned[i] });
      }
    }
    // Always include the latest point
    const last = prices.length - 1;
    if (last % 7 !== 0) {
      priceLine.push({ time: prices[last].date, value: prices[last].close });
      if (aligned[last] > 0) {
        realizedLine.push({ time: prices[last].date, value: aligned[last] });
      }
    }

    // Backtest: every time MVRV drops below BACKTEST_TRIGGER
    const backtest = runBacktest(prices, mvrv, {
      title: `Every time price approached realized price (MVRV < ${BACKTEST_TRIGGER})`,
      columns: [
        { key: "date", label: "Date" },
        { key: "price", label: "BTC Price" },
        { key: "realized", label: "Realized" },
        { key: "mvrvVal", label: "MVRV" },
        { key: "return6m", label: "6mo Return" },
        { key: "return12m", label: "12mo Return" },
      ],
      trigger: (prices, i, computed) => {
        if (isNaN(computed[i]) || computed[i] >= BACKTEST_TRIGGER) return null;
        // Only trigger from 2012 onward (enough data)
        if (prices[i].timestamp < 1325376000) return null;
        return {
          date: formatDate(prices[i].date),
          price: formatCurrency(Math.round(prices[i].close)),
          realized: formatCurrency(Math.round(aligned[i])),
          mvrvVal: formatNumber(computed[i]),
        };
      },
      enrich: (row, triggerIndex, prices) => {
        const i6m = triggerIndex + 180;
        const i12m = triggerIndex + 365;
        const triggerPrice = prices[triggerIndex].close;

        const r6m =
          i6m < prices.length
            ? ((prices[i6m].close - triggerPrice) / triggerPrice) * 100
            : NaN;
        const r12m =
          i12m < prices.length
            ? ((prices[i12m].close - triggerPrice) / triggerPrice) * 100
            : NaN;

        return {
          ...row,
          return6m: isNaN(r6m) ? "?" : formatPercent(r6m),
          return12m: isNaN(r12m) ? "?" : formatPercent(r12m),
        };
      },
      cooldownDays: 90,
    });

    const distancePct =
      currentRealized > 0
        ? ((prices[last].close - currentRealized) / currentRealized) * 100
        : 0;

    return {
      id: this.id,
      name: this.name,
      description: "Average on-chain cost basis of all BTC",
      currentValue: currentRealized,
      currentValueLabel: `${formatCurrency(Math.round(currentRealized))} (MVRV ${formatNumber(currentMvrv)})`,
      signal: getSignal(currentMvrv),
      signalRules: `At/below realized = buy · MVRV >${SELL_THRESHOLD} = sell · Now ${Math.round(distancePct)}% above`,
      chartData: {
        lines: [
          { label: "BTC Price", color: "#e4e4e7", data: priceLine },
          { label: "Realized Price", color: "#f59e0b", data: realizedLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: true },
      backtestTitle: backtest.title,
      backtestColumns: backtest.columns,
      backtestRows: backtest.rows,
    };
  }
}

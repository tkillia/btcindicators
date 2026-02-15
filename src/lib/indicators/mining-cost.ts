import { DailyPrice } from "../data/types";
import { fetchMiningCost } from "../data/fetch-mining-data";
import { formatCurrency, formatDate, formatPercent } from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

export class MiningCost implements Indicator {
  id = "mining-cost";
  name = "Avg Mining Cost";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const miningData = await fetchMiningCost();

    if (miningData.length < 2) {
      return this.emptyResult();
    }

    const costs = miningData.map((d) => d.estimatedCost);
    const currentCost = costs[costs.length - 1];
    const currentPrice = prices[prices.length - 1].close;
    const ratio = currentCost > 0 ? currentPrice / currentCost : 0;

    // Signal: price relative to mining cost
    // Below mining cost = extremely oversold, miners capitulating = buy
    // > 3x mining cost = euphoria = sell
    let signal: "buy" | "neutral" | "sell";
    if (ratio <= 1.2) signal = "buy";
    else if (ratio >= 3) signal = "sell";
    else signal = "neutral";

    // Chart: two lines — BTC price and estimated mining cost
    const btcByDate = new Map(prices.map((p) => [p.date, p.close]));

    const costLine: Array<{ time: string; value: number }> = [];
    const btcLine: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < miningData.length; i++) {
      costLine.push({
        time: miningData[i].date,
        value: miningData[i].estimatedCost,
      });
      const btc = btcByDate.get(miningData[i].date);
      if (btc) {
        btcLine.push({ time: miningData[i].date, value: btc });
      }
    }

    // Backtest: when price dropped below 1.5x mining cost
    const backtestRows = buildCostBacktest(miningData, prices);

    return {
      id: this.id,
      name: this.name,
      description: `Est. production cost · Price/Cost: ${ratio.toFixed(1)}x`,
      currentValue: currentCost,
      currentValueLabel: formatCurrency(Math.round(currentCost)),
      signal,
      signalRules: "Price ≤1.2x cost = capitulation buy · ≥3x = euphoria sell",
      chartData: {
        lines: [
          { label: "BTC Price", color: "#e4e4e7", data: btcLine },
          { label: "Est. Mining Cost", color: "#f59e0b", data: costLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: true },
      backtestTitle: "Every time BTC dropped below 1.5x mining cost",
      backtestColumns: ["Date", "Mining Cost", "BTC Price", "Ratio", "6mo Return"],
      backtestRows: backtestRows,
    };
  }

  private emptyResult(): IndicatorResult {
    return {
      id: this.id,
      name: this.name,
      description: "Estimated BTC production cost",
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

function buildCostBacktest(
  miningData: Array<{ date: string; estimatedCost: number }>,
  prices: DailyPrice[]
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  const btcByDate = new Map(prices.map((p) => [p.date, p.close]));
  const priceByIndex = new Map(prices.map((p, i) => [p.date, i]));
  let lastTrigger = -Infinity;

  for (let i = 0; i < miningData.length; i++) {
    if (i - lastTrigger < 60) continue;
    const cost = miningData[i].estimatedCost;
    if (cost <= 0) continue;

    const btcPrice = btcByDate.get(miningData[i].date);
    if (!btcPrice) continue;

    const ratio = btcPrice / cost;
    if (ratio > 1.5) continue;

    // Look ahead 180 days
    const priceIdx = priceByIndex.get(miningData[i].date);
    const futureIdx = priceIdx !== undefined ? priceIdx + 180 : undefined;
    const futurePrice =
      futureIdx !== undefined && futureIdx < prices.length
        ? prices[futureIdx].close
        : null;

    const ret = futurePrice
      ? ((futurePrice - btcPrice) / btcPrice) * 100
      : NaN;

    rows.push({
      date: formatDate(miningData[i].date),
      cost: formatCurrency(Math.round(cost)),
      btcPrice: formatCurrency(Math.round(btcPrice)),
      ratio: `${ratio.toFixed(2)}x`,
      ret6m: isNaN(ret) ? "?" : formatPercent(ret),
    });

    lastTrigger = i;
  }

  return rows;
}

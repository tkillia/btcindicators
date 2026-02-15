import { DailyPrice } from "../data/types";
import {
  fetchStablecoinSupply,
  StablecoinDataPoint,
} from "../data/fetch-stablecoin-supply";
import { sma } from "../utils/moving-average";
import {
  formatDate,
  formatPercent,
} from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

const MOMENTUM_PERIOD = 30; // 30-day rate of change
const BULLISH_THRESHOLD = 3; // 30d change > 3% = expanding
const BEARISH_THRESHOLD = -1; // 30d change < -1% = contracting
const BACKTEST_GROWTH_THRESHOLD = 5; // 30d growth > 5% = rapid expansion
const BACKTEST_COOLDOWN = 60;

function formatSupply(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

function computeRateOfChange(
  data: number[],
  period: number
): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  for (let i = period; i < data.length; i++) {
    if (data[i - period] > 0) {
      result[i] = ((data[i] - data[i - period]) / data[i - period]) * 100;
    }
  }
  return result;
}

export class StablecoinSupply implements Indicator {
  id = "stablecoin-supply";
  name = "Stablecoin Supply";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const supplyData = await fetchStablecoinSupply();

    const supplies = supplyData.map((d) => d.supply);
    const roc30d = computeRateOfChange(supplies, MOMENTUM_PERIOD);
    const sma90 = sma(supplies, 90);

    const currentSupply = supplies[supplies.length - 1];
    const currentRoc = roc30d[roc30d.length - 1];

    // Signal based on 30-day rate of change
    let signal: "buy" | "neutral" | "sell";
    if (currentRoc > BULLISH_THRESHOLD) signal = "buy";
    else if (currentRoc < BEARISH_THRESHOLD) signal = "sell";
    else signal = "neutral";

    // Chart: supply line + 90-day SMA
    const supplyLine: Array<{ time: string; value: number }> = [];
    const smaLine: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < supplyData.length; i++) {
      supplyLine.push({
        time: supplyData[i].date,
        value: supplyData[i].supply,
      });
      if (!isNaN(sma90[i])) {
        smaLine.push({
          time: supplyData[i].date,
          value: sma90[i],
        });
      }
    }

    // Backtest: every time 30d supply growth exceeded threshold
    // (rapid liquidity expansion — historically bullish for BTC)
    const backtestRows = buildGrowthBacktest(supplyData, roc30d, prices);

    return {
      id: this.id,
      name: this.name,
      description: "Combined USDT + USDC circulating supply",
      currentValue: currentSupply,
      currentValueLabel: formatSupply(currentSupply),
      signal,
      signalRules: `30d change: Expanding >${BULLISH_THRESHOLD}% · Contracting <${BEARISH_THRESHOLD}%`,
      chartData: {
        lines: [
          {
            label: "USDT + USDC Supply",
            color: "#22c55e",
            data: supplyLine,
          },
          { label: "90-day SMA", color: "#a1a1aa", data: smaLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: false },
      backtestTitle: `Every time 30d supply growth exceeded ${BACKTEST_GROWTH_THRESHOLD}%`,
      backtestColumns: ["Date", "Supply", "30d Growth", "BTC Price", "BTC 3mo Return"],
      backtestRows: backtestRows,
    };
  }
}

/**
 * Backtest: every time stablecoin supply grew >5% in 30 days.
 * Rapid liquidity expansion signals new capital entering crypto.
 */
function buildGrowthBacktest(
  supplyData: StablecoinDataPoint[],
  roc30d: number[],
  btcPrices: DailyPrice[]
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  let lastTriggerIdx = -Infinity;

  const btcByDate = new Map<string, number>();
  for (const p of btcPrices) {
    btcByDate.set(p.date, p.close);
  }

  for (let i = 0; i < supplyData.length; i++) {
    if (i - lastTriggerIdx < BACKTEST_COOLDOWN) continue;
    if (isNaN(roc30d[i]) || roc30d[i] < BACKTEST_GROWTH_THRESHOLD) continue;

    const btcPrice = btcByDate.get(supplyData[i].date);
    if (!btcPrice) continue;

    // Look ahead 90 days for BTC return
    const futureDate = new Date(supplyData[i].timestamp * 1000);
    futureDate.setUTCDate(futureDate.getUTCDate() + 90);
    const futureDateStr = futureDate.toISOString().split("T")[0];
    const futureBtcPrice = btcByDate.get(futureDateStr);

    const return3m = futureBtcPrice
      ? ((futureBtcPrice - btcPrice) / btcPrice) * 100
      : NaN;

    rows.push({
      date: formatDate(supplyData[i].date),
      supply: formatSupply(supplyData[i].supply),
      growth: formatPercent(roc30d[i]),
      btcPrice: `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      btcReturn: isNaN(return3m) ? "?" : formatPercent(return3m),
    });

    lastTriggerIdx = i;
  }

  return rows;
}

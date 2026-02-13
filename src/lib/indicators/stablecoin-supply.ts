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
const BACKTEST_COOLDOWN = 90;

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

    // Backtest: every time supply hit a new ATH after being below it
    // (signals new liquidity expansion after a contraction)
    const backtestRows = buildNewAthBacktest(supplyData, prices);

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
      backtestTitle: "Every time supply set new ATH (after pullback)",
      backtestColumns: ["Date", "Supply", "BTC Price", "BTC 6mo Return"],
      backtestRows: backtestRows,
    };
  }
}

/**
 * Find every time combined stablecoin supply set a new ATH
 * after having pulled back at least 5% from the previous ATH.
 * Then look at what BTC did over the next 6 months.
 */
function buildNewAthBacktest(
  supplyData: StablecoinDataPoint[],
  btcPrices: DailyPrice[]
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  let ath = 0;
  let hadPullback = false;
  let lastTriggerIdx = -Infinity;

  // Build BTC price lookup by date
  const btcByDate = new Map<string, number>();
  for (const p of btcPrices) {
    btcByDate.set(p.date, p.close);
  }

  for (let i = 0; i < supplyData.length; i++) {
    const supply = supplyData[i].supply;

    if (supply > ath) {
      if (hadPullback && i - lastTriggerIdx >= BACKTEST_COOLDOWN) {
        // New ATH after a pullback — this is our signal
        const btcPrice = btcByDate.get(supplyData[i].date);
        if (btcPrice) {
          // Look ahead 180 days for BTC return
          const futureDate = new Date(supplyData[i].timestamp * 1000);
          futureDate.setUTCDate(futureDate.getUTCDate() + 180);
          const futureDateStr = futureDate.toISOString().split("T")[0];
          const futureBtcPrice = btcByDate.get(futureDateStr);

          const return6m = futureBtcPrice
            ? ((futureBtcPrice - btcPrice) / btcPrice) * 100
            : NaN;

          rows.push({
            date: formatDate(supplyData[i].date),
            supply: formatSupply(supply),
            btcPrice: `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            btcReturn: isNaN(return6m) ? "?" : formatPercent(return6m),
          });

          lastTriggerIdx = i;
        }
      }
      ath = supply;
      hadPullback = false;
    } else if (supply < ath * 0.95) {
      hadPullback = true;
    }
  }

  return rows;
}

import { DailyPrice } from "../data/types";
import { fetchBitfinexLongs } from "../data/fetch-bitfinex-longs";
import { sma } from "../utils/moving-average";
import { formatDate, formatPercent } from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

const SMA_PERIOD = 30;
// When longs are significantly above/below their 30d average
const BULLISH_THRESHOLD = 10; // 30d change > 10% = aggressive accumulation
const BEARISH_THRESHOLD = -10;
const SPIKE_THRESHOLD = 10; // backtest: longs >10% above SMA
const SPIKE_COOLDOWN = 14;

function formatLongs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K BTC`;
  return `${value.toFixed(0)} BTC`;
}

export class BitfinexLongs implements Indicator {
  id = "bitfinex-longs";
  name = "Bitfinex Longs";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const longsData = await fetchBitfinexLongs(365);

    if (longsData.length < 2) {
      return this.emptyResult();
    }

    const values = longsData.map((d) => d.longs);
    const sma30 = sma(values, SMA_PERIOD);

    const current = values[values.length - 1];
    const prev30 =
      values.length > 30 ? values[values.length - 31] : values[0];
    const roc30d = prev30 > 0 ? ((current - prev30) / prev30) * 100 : 0;

    // Signal: based on 30-day rate of change
    let signal: "buy" | "neutral" | "sell";
    if (roc30d > BULLISH_THRESHOLD) signal = "buy";
    else if (roc30d < BEARISH_THRESHOLD) signal = "sell";
    else signal = "neutral";

    // Chart: longs line + 30-day SMA
    const longsLine: Array<{ time: string; value: number }> = [];
    const smaLine: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < longsData.length; i++) {
      longsLine.push({ time: longsData[i].date, value: longsData[i].longs });
      if (!isNaN(sma30[i])) {
        smaLine.push({ time: longsData[i].date, value: sma30[i] });
      }
    }

    // Backtest: when longs spike above SMA, what does BTC do?
    const btcByDate = new Map(prices.map((p) => [p.date, p.close]));
    const backtestRows = buildSpikeBacktest(longsData, sma30, btcByDate);

    return {
      id: this.id,
      name: this.name,
      description: "BTC margin long positions on Bitfinex",
      currentValue: current,
      currentValueLabel: formatLongs(current),
      signal,
      signalRules: `30d change: Accumulating >${BULLISH_THRESHOLD}% · Reducing <${BEARISH_THRESHOLD}%`,
      chartData: {
        lines: [
          { label: "BTC Longs", color: "#22c55e", data: longsLine },
          { label: "30-day SMA", color: "#a1a1aa", data: smaLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: false },
      backtestTitle: `When longs spike >${SPIKE_THRESHOLD}% above 30d SMA`,
      backtestColumns: ["Date", "Longs", "Deviation", "BTC Price", "1mo Return"],
      backtestRows: backtestRows,
    };
  }

  private emptyResult(): IndicatorResult {
    return {
      id: this.id,
      name: this.name,
      description: "BTC margin long positions on Bitfinex",
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

function buildSpikeBacktest(
  longsData: Array<{ date: string; longs: number }>,
  sma30: number[],
  btcByDate: Map<string, number>
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  let lastTrigger = -Infinity;

  for (let i = 0; i < longsData.length; i++) {
    if (i - lastTrigger < SPIKE_COOLDOWN) continue;
    if (isNaN(sma30[i]) || sma30[i] === 0) continue;

    const deviation = ((longsData[i].longs - sma30[i]) / sma30[i]) * 100;
    if (deviation < SPIKE_THRESHOLD) continue;

    const btcPrice = btcByDate.get(longsData[i].date);
    if (!btcPrice) continue;

    // Look ahead 30 days
    const futureDate = new Date(longsData[i].date + "T00:00:00Z");
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    const futureDateStr = futureDate.toISOString().split("T")[0];
    const futureBtc = btcByDate.get(futureDateStr);

    const ret = futureBtc
      ? ((futureBtc - btcPrice) / btcPrice) * 100
      : NaN;

    rows.push({
      date: formatDate(longsData[i].date),
      longs: formatLongs(longsData[i].longs),
      deviation: `+${deviation.toFixed(0)}%`,
      btcPrice: `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      btcReturn: isNaN(ret) ? "?" : formatPercent(ret),
    });

    lastTrigger = i;
  }

  return rows;
}

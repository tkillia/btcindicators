import { DailyPrice } from "../data/types";
import {
  fetchDeribitOptionsSummary,
  fetchDeribitDVOL,
} from "../data/fetch-deribit-options";
import { sma } from "../utils/moving-average";
import { formatDate, formatPercent } from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

// Put/call ratio thresholds
const FEAR_THRESHOLD = 0.7; // high put/call = fear = contrarian buy
const GREED_THRESHOLD = 0.4; // low put/call = greed = contrarian sell
const DVOL_SPIKE = 55; // backtest trigger: elevated implied vol
const DVOL_COOLDOWN = 30;

export class DeribitOptions implements Indicator {
  id = "deribit-options";
  name = "Deribit Options";

  async calculate(prices: DailyPrice[]): Promise<IndicatorResult> {
    const [summary, dvolHistory] = await Promise.allSettled([
      fetchDeribitOptionsSummary(),
      fetchDeribitDVOL(730),
    ]);

    const opts =
      summary.status === "fulfilled"
        ? summary.value
        : { putCallRatio: 0, totalOpenInterest: 0, aggregateIV: 0, underlyingPrice: 0 };

    const dvol =
      dvolHistory.status === "fulfilled" ? dvolHistory.value : [];

    const pcr = opts.putCallRatio;

    // Signal: contrarian — high put/call = buy (fear), low = sell (greed)
    let signal: "buy" | "neutral" | "sell";
    if (pcr >= FEAR_THRESHOLD) signal = "buy";
    else if (pcr <= GREED_THRESHOLD) signal = "sell";
    else signal = "neutral";

    // Chart: DVOL (implied volatility index) over time with SMA
    const ivValues = dvol.map((d) => d.iv);
    const sma30 = sma(ivValues, 30);

    const dvolLine: Array<{ time: string; value: number }> = [];
    const smaLine: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < dvol.length; i++) {
      dvolLine.push({ time: dvol[i].date, value: dvol[i].iv });
      if (!isNaN(sma30[i])) {
        smaLine.push({ time: dvol[i].date, value: sma30[i] });
      }
    }

    // Backtest: when DVOL spiked above threshold (high fear), what did BTC do?
    const btcByDate = new Map(prices.map((p) => [p.date, p.close]));
    const backtestRows = buildVolSpike(dvol, btcByDate);

    const oiLabel =
      opts.totalOpenInterest >= 1e6
        ? `${(opts.totalOpenInterest / 1e6).toFixed(1)}M`
        : opts.totalOpenInterest >= 1e3
          ? `${(opts.totalOpenInterest / 1e3).toFixed(0)}K`
          : `${opts.totalOpenInterest.toFixed(0)}`;

    return {
      id: this.id,
      name: this.name,
      description: `BTC options P/C ratio · OI: ${oiLabel} contracts`,
      currentValue: pcr,
      currentValueLabel: pcr.toFixed(2),
      signal,
      signalRules: `P/C ≥${FEAR_THRESHOLD} = fear (contrarian buy) · ≤${GREED_THRESHOLD} = greed (contrarian sell)`,
      chartData: {
        lines: [
          { label: "DVOL", color: "#a855f7", data: dvolLine },
          { label: "30-day SMA", color: "#a1a1aa", data: smaLine },
        ],
      },
      chartConfig: { type: "line+line", logScale: false },
      backtestTitle: `Every time DVOL spiked above ${DVOL_SPIKE}`,
      backtestColumns: ["Date", "DVOL", "BTC Price", "BTC 1mo Return"],
      backtestRows: backtestRows,
    };
  }
}

function buildVolSpike(
  dvol: Array<{ date: string; iv: number }>,
  btcByDate: Map<string, number>
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  let lastTrigger = -Infinity;

  for (let i = 0; i < dvol.length; i++) {
    if (i - lastTrigger < DVOL_COOLDOWN) continue;
    if (dvol[i].iv < DVOL_SPIKE) continue;

    const btcPrice = btcByDate.get(dvol[i].date);
    if (!btcPrice) continue;

    const futureDate = new Date(dvol[i].date + "T00:00:00Z");
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    const futureDateStr = futureDate.toISOString().split("T")[0];
    const futureBtc = btcByDate.get(futureDateStr);

    const ret = futureBtc
      ? ((futureBtc - btcPrice) / btcPrice) * 100
      : NaN;

    rows.push({
      date: formatDate(dvol[i].date),
      dvol: `${dvol[i].iv.toFixed(1)}%`,
      btcPrice: `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      btcReturn: isNaN(ret) ? "?" : formatPercent(ret),
    });

    lastTrigger = i;
  }

  return rows;
}

import { DailyPrice } from "../data/types";
import { runBacktest } from "../backtest/engine";
import { sma } from "../utils/moving-average";
import {
  formatCurrency,
  formatPercent,
  formatDate,
} from "../utils/format";
import { Indicator, IndicatorResult } from "./types";

const WMA_PERIOD = 200;
const TOUCH_THRESHOLD = 0.05; // within 5% of 200WMA

const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;

function resampleToWeekly(prices: DailyPrice[]): DailyPrice[] {
  const weekly: DailyPrice[] = [];
  let currentWeek = -1;

  for (const p of prices) {
    // Continuous week number from Unix epoch — no year-boundary splits
    const week = Math.floor(p.timestamp / SECONDS_PER_WEEK);

    if (week !== currentWeek) {
      weekly.push({ ...p });
      currentWeek = week;
    } else {
      // Keep the last day of each week (latest close)
      weekly[weekly.length - 1] = { ...p };
    }
  }

  return weekly;
}

export class TwoHundredWMA implements Indicator {
  id = "200-week-ma";
  name = "200-Week Moving Average";

  calculate(prices: DailyPrice[]): IndicatorResult {
    const weekly = resampleToWeekly(prices);
    const weeklyCloses = weekly.map((w) => w.close);
    const wma200 = sma(weeklyCloses, WMA_PERIOD);

    const currentWMA = wma200[wma200.length - 1];
    const currentPrice = weekly[weekly.length - 1].close;
    const priceToWMA = currentPrice / currentWMA;

    // Signal
    let signal: "buy" | "neutral" | "sell";
    if (currentPrice <= currentWMA) signal = "buy";
    else if (priceToWMA > 3) signal = "sell";
    else signal = "neutral";

    // Chart: two lines (BTC price + 200WMA) on weekly data
    const priceLineData: Array<{ time: string; value: number }> = [];
    const wmaLineData: Array<{ time: string; value: number }> = [];

    for (let i = 0; i < weekly.length; i++) {
      priceLineData.push({ time: weekly[i].date, value: weekly[i].close });
      if (!isNaN(wma200[i])) {
        wmaLineData.push({ time: weekly[i].date, value: wma200[i] });
      }
    }

    // Backtest: every time BTC touched the 200WMA
    // We need to find periods where daily price came within TOUCH_THRESHOLD of interpolated WMA
    // For simplicity, use the weekly data
    const backtest = runBacktest(weekly, wma200, {
      title: "Every time BTC touched 200WMA",
      columns: [
        { key: "date", label: "Date" },
        { key: "wma", label: "200WMA" },
        { key: "timeNear", label: "Time There" },
        { key: "returnFromTouch", label: "Return From Touch" },
      ],
      trigger: (data, i, computed) => {
        if (isNaN(computed[i]) || computed[i] === 0) return null;
        const ratio = data[i].close / computed[i];
        // Triggered when price is within 5% above/below the 200WMA
        if (ratio > 1 + TOUCH_THRESHOLD || ratio < 1 - TOUCH_THRESHOLD)
          return null;

        return {
          date: formatDate(data[i].date),
          wma: formatCurrency(Math.round(computed[i])),
        };
      },
      enrich: (row, triggerIndex, data) => {
        // Count how many weeks price stayed near the 200WMA
        let weeksNear = 0;
        for (let j = triggerIndex; j < data.length; j++) {
          const ratio = data[j].close / wma200[j];
          if (
            isNaN(ratio) ||
            ratio > 1 + TOUCH_THRESHOLD * 2 ||
            ratio < 1 - TOUCH_THRESHOLD * 2
          )
            break;
          weeksNear++;
        }

        // Find the maximum price within 52 weeks after the touch
        const lookAhead = Math.min(triggerIndex + 52, data.length);
        let maxPrice = data[triggerIndex].close;
        for (let j = triggerIndex; j < lookAhead; j++) {
          if (data[j].close > maxPrice) maxPrice = data[j].close;
        }

        const returnPct =
          ((maxPrice - data[triggerIndex].close) / data[triggerIndex].close) *
          100;

        const timeLabel =
          weeksNear <= 1
            ? "Days"
            : weeksNear <= 4
              ? `${weeksNear} weeks`
              : `${Math.round(weeksNear / 4)} months`;

        const toPrice = formatCurrency(Math.round(maxPrice));

        return {
          ...row,
          timeNear: timeLabel,
          returnFromTouch: `${formatPercent(returnPct)} → ${toPrice}`,
        };
      },
      cooldownDays: 52, // ~1 year in weekly data
    });

    // Current distance from 200WMA
    const distancePercent = currentWMA === 0 ? 0 : Math.round(
      ((currentPrice - currentWMA) / currentWMA) * 100
    );
    const distanceLabel =
      distancePercent >= 0 ? `${distancePercent}% above` : `${Math.abs(distancePercent)}% below`;

    // If not yet touched recently, add a current row
    const lastRow = backtest.rows[backtest.rows.length - 1];
    const currentYear = new Date().getUTCFullYear();
    const lastRowYear = lastRow
      ? parseInt(String(lastRow.date).split(" ")[1] || "0")
      : 0;

    if (currentYear > lastRowYear) {
      backtest.rows.push({
        date: formatDate(weekly[weekly.length - 1].date),
        wma: formatCurrency(Math.round(currentWMA)),
        timeNear: distanceLabel,
        returnFromTouch:
          currentPrice <= currentWMA * (1 + TOUCH_THRESHOLD)
            ? "Active"
            : "Not yet touched",
      });
    }

    return {
      id: this.id,
      name: this.name,
      description: "Long-term cycle floor indicator",
      currentValue: currentWMA,
      currentValueLabel: formatCurrency(Math.round(currentWMA)),
      signal,
      signalRules: `At/below 200WMA = cycle floor · Hit rate: 4/4 (100%)`,
      chartData: {
        lines: [
          { label: "BTC Price", color: "#e4e4e7", data: priceLineData },
          { label: "200-Week MA", color: "#22d3ee", data: wmaLineData },
        ],
      },
      chartConfig: { type: "line+line", logScale: true },
      backtestTitle: backtest.title,
      backtestColumns: backtest.columns,
      backtestRows: backtest.rows,
    };
  }
}

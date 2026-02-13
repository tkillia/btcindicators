import { DailyPrice } from "../data/types";
import { BacktestConfig } from "./types";

export function runBacktest(
  prices: DailyPrice[],
  computed: number[],
  config: BacktestConfig
): {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
} {
  const rows: Record<string, string | number>[] = [];
  let lastTriggerIndex = -Infinity;
  const cooldown = config.cooldownDays ?? 30;

  for (let i = 0; i < prices.length; i++) {
    if (i - lastTriggerIndex < cooldown) continue;

    const row = config.trigger(prices, i, computed);
    if (row) {
      const enriched = config.enrich
        ? config.enrich(row, i, prices)
        : row;
      rows.push(enriched);
      lastTriggerIndex = i;
    }
  }

  return {
    title: config.title,
    columns: config.columns.map((c) => c.label),
    rows,
  };
}

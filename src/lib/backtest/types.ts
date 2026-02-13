import { DailyPrice } from "../data/types";

export interface BacktestConfig {
  title: string;
  columns: Array<{ key: string; label: string }>;
  trigger: (
    prices: DailyPrice[],
    index: number,
    computed: number[]
  ) => Record<string, string | number> | null;
  enrich?: (
    row: Record<string, string | number>,
    triggerIndex: number,
    prices: DailyPrice[]
  ) => Record<string, string | number>;
  cooldownDays?: number;
}

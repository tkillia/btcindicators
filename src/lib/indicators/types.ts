import { DailyPrice } from "../data/types";

export interface ChartLine {
  label: string;
  color: string;
  data: Array<{ time: string; value: number }>;
}

export interface ChartBar {
  time: string;
  value: number;
  color: string;
}

export interface ChartMarker {
  time: string;
  label: string;
  color: string;
}

export interface ChartDataSet {
  lines?: ChartLine[];
  bars?: ChartBar[];
  markers?: ChartMarker[];
}

export interface ChartConfig {
  type: "line" | "bar" | "line+line" | "line+histogram";
  logScale?: boolean;
}

export type BacktestRow = Record<string, string | number>;

export interface IndicatorResult {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  currentValueLabel: string;
  signal: "buy" | "neutral" | "sell";
  signalRules: string;
  chartData: ChartDataSet;
  chartConfig: ChartConfig;
  backtestTitle: string;
  backtestColumns: string[];
  backtestRows: BacktestRow[];
}

export interface Indicator {
  id: string;
  name: string;
  calculate(prices: DailyPrice[]): IndicatorResult | Promise<IndicatorResult>;
}

import type { DeepPartial, ChartOptions } from "lightweight-charts";

export const chartTheme: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: "#12121a" },
    textColor: "#a1a1aa",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontSize: 12,
  },
  grid: {
    vertLines: { color: "#1e1e2e" },
    horzLines: { color: "#1e1e2e" },
  },
  crosshair: {
    mode: 0,
  },
  rightPriceScale: {
    borderColor: "#1e1e2e",
  },
  timeScale: {
    borderColor: "#1e1e2e",
    timeVisible: false,
  },
};

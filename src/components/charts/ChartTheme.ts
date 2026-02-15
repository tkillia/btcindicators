import type { DeepPartial, ChartOptions } from "lightweight-charts";

export const chartTheme: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: "#12121a" },
    textColor: "#b4b4bd",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "#1e1e30" },
    horzLines: { color: "#1e1e30" },
  },
  crosshair: {
    mode: 0,
  },
  rightPriceScale: {
    borderColor: "#232334",
  },
  timeScale: {
    borderColor: "#232334",
    timeVisible: false,
  },
};

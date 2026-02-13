"use client";

import { useRef, useEffect } from "react";
import {
  createChart,
  type IChartApi,
  LineSeries,
  HistogramSeries,
  PriceScaleMode,
  CrosshairMode,
} from "lightweight-charts";
import type { ChartDataSet, ChartConfig } from "@/lib/indicators/types";
import { chartTheme } from "./ChartTheme";

interface Props {
  data: ChartDataSet;
  config: ChartConfig;
  height?: number;
}

export function LightweightChart({ data, config, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...chartTheme,
      height,
      width: containerRef.current.clientWidth,
      crosshair: { mode: CrosshairMode.Normal },
    });

    if (config.logScale) {
      chart.priceScale("right").applyOptions({
        mode: PriceScaleMode.Logarithmic,
      });
    }

    // Add line series
    if (data.lines) {
      for (const line of data.lines) {
        const series = chart.addSeries(LineSeries, {
          color: line.color,
          title: line.label,
          lineWidth: 2,
          priceLineVisible: false,
        });
        series.setData(
          line.data.map((d) => ({ time: d.time, value: d.value }))
        );
      }
    }

    // Add histogram/bar series
    if (data.bars) {
      const series = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
      });
      series.setData(
        data.bars.map((b) => ({
          time: b.time,
          value: b.value,
          color: b.color,
        }))
      );
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, config, height]);

  return <div ref={containerRef} className="w-full" />;
}

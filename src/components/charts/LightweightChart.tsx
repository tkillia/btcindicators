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
}

export function LightweightChart({ data, config }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const errorRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || errorRef.current) return;

    try {
      const isMobile = containerRef.current.clientWidth < 500;
      const height = isMobile ? 220 : 280;

      const chart = createChart(containerRef.current, {
        ...chartTheme,
        height,
        width: containerRef.current.clientWidth || 300,
        crosshair: { mode: CrosshairMode.Normal },
      });

      if (config.logScale) {
        chart.priceScale("right").applyOptions({
          mode: PriceScaleMode.Logarithmic,
        });
      }

      if (data.lines) {
        for (const line of data.lines) {
          if (line.data.length === 0) continue;
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
    } catch {
      errorRef.current = true;
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<div class="w-full h-full flex items-center justify-center"><span class="text-muted text-xs">Chart unavailable</span></div>';
      }
    }
  }, [data, config]);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[220px] sm:min-h-[280px]"
    />
  );
}

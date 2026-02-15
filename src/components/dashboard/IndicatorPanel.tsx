import type { IndicatorResult } from "@/lib/indicators/types";
import { LightweightChart } from "@/components/charts/LightweightChart";
import { BacktestTable } from "@/components/tables/BacktestTable";
import { Badge } from "@/components/ui/Badge";

interface Props {
  result: IndicatorResult;
}

const valueColor = {
  buy: "text-buy",
  neutral: "text-neutral",
  sell: "text-sell",
};

export function IndicatorPanel({ result }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 md:p-5 transition-colors hover:border-border/80">
      {/* Header */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">
              {result.name}
            </h2>
            <p className="text-xs text-muted mt-0.5 line-clamp-1">
              {result.description}
            </p>
          </div>
          <span
            className={`text-xl sm:text-2xl font-bold font-mono shrink-0 ${valueColor[result.signal]}`}
          >
            {result.currentValueLabel}
          </span>
        </div>
      </div>

      {/* Signal */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <Badge signal={result.signal} />
        <span className="text-[11px] sm:text-xs text-muted">
          {result.signalRules}
        </span>
      </div>

      {/* Chart */}
      <div className="rounded-lg overflow-hidden -mx-1">
        <LightweightChart
          data={result.chartData}
          config={result.chartConfig}
        />
      </div>

      {/* Backtest Table */}
      {result.backtestRows.length > 0 && (
        <BacktestTable
          title={result.backtestTitle}
          columns={result.backtestColumns}
          rows={result.backtestRows}
        />
      )}
    </div>
  );
}

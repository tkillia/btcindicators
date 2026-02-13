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
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {result.name}
          </h2>
          <p className="text-xs text-muted">{result.description}</p>
        </div>
        <span className={`text-2xl font-bold font-mono ${valueColor[result.signal]}`}>
          {result.currentValueLabel}
        </span>
      </div>

      {/* Signal */}
      <div className="flex items-center gap-3 mb-4">
        <Badge signal={result.signal} />
        <span className="text-xs text-muted">{result.signalRules}</span>
      </div>

      {/* Chart */}
      <div className="rounded-lg overflow-hidden">
        <LightweightChart
          data={result.chartData}
          config={result.chartConfig}
          height={280}
        />
      </div>

      {/* Backtest Table */}
      <BacktestTable
        title={result.backtestTitle}
        columns={result.backtestColumns}
        rows={result.backtestRows}
      />
    </div>
  );
}

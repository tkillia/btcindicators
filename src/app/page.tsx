import { fetchBtcHistory } from "@/lib/data/fetch-btc-history";
import { indicators } from "@/lib/indicators/registry";
import { IndicatorGrid } from "@/components/dashboard/IndicatorGrid";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { IndicatorResult } from "@/lib/indicators/types";

interface FailedIndicator {
  name: string;
  error: string;
}

export default async function DashboardPage() {
  const prices = await fetchBtcHistory();

  const settled = await Promise.allSettled(
    indicators.map((ind) => ind.calculate(prices))
  );

  const results: IndicatorResult[] = [];
  const failed: FailedIndicator[] = [];

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      console.error("Indicator failed:", r.reason);
      failed.push({
        name: indicators[i].name,
        error: r.reason instanceof Error ? r.reason.message : "Unknown error",
      });
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto">
      <DashboardHeader
        lastUpdated={prices[prices.length - 1].date}
        indicatorCount={results.length}
      />
      {failed.length > 0 && (
        <div className="mb-3 sm:mb-4 rounded-lg border border-sell/30 bg-sell/5 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm text-sell font-medium">
            {failed.length} indicator{failed.length > 1 ? "s" : ""} failed to
            load
          </p>
          <ul className="mt-1 space-y-0.5">
            {failed.map((f) => (
              <li key={f.name} className="text-[11px] sm:text-xs text-muted">
                {f.name}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <IndicatorGrid results={results} />
    </main>
  );
}

import { fetchBtcHistory } from "@/lib/data/fetch-btc-history";
import { indicators } from "@/lib/indicators/registry";
import { IndicatorGrid } from "@/components/dashboard/IndicatorGrid";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { IndicatorResult } from "@/lib/indicators/types";

export default async function DashboardPage() {
  const prices = await fetchBtcHistory();

  const settled = await Promise.allSettled(
    indicators.map((ind) => ind.calculate(prices))
  );

  const results: IndicatorResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      console.error("Indicator failed:", r.reason);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto">
      <DashboardHeader lastUpdated={prices[prices.length - 1].date} />
      <IndicatorGrid results={results} />
    </main>
  );
}

import { RefreshButton } from "@/components/shared/RefreshButton";

interface Props {
  lastUpdated: string;
  indicatorCount: number;
}

export function DashboardHeader({ lastUpdated, indicatorCount }: Props) {
  return (
    <header className="mb-5 sm:mb-8 flex items-start justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          BTC Indicators
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-1">
          {indicatorCount} backtested signals · Updated{" "}
          <span className="text-foreground font-mono">{lastUpdated}</span>
        </p>
      </div>
      <RefreshButton />
    </header>
  );
}

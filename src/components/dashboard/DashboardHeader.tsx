interface Props {
  lastUpdated: string;
}

export function DashboardHeader({ lastUpdated }: Props) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-foreground tracking-tight">
        BTC Indicators
      </h1>
      <p className="text-sm text-muted mt-1">
        Backtested Bitcoin signals · Last updated{" "}
        <span className="text-foreground font-mono">{lastUpdated}</span>
      </p>
    </header>
  );
}

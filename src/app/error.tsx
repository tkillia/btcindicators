"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
          Failed to load dashboard
        </h2>
        <p className="text-sm text-muted mb-4">
          Could not fetch BTC price data. This usually means the data API is
          temporarily unavailable.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/80 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

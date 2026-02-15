function SkeletonPanel() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 md:p-5 animate-pulse">
      {/* Header */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-5 sm:h-6 bg-border/60 rounded w-2/3" />
            <div className="h-3 bg-border/40 rounded w-4/5 mt-2" />
          </div>
          <div className="h-7 sm:h-8 bg-border/60 rounded w-16 shrink-0" />
        </div>
      </div>

      {/* Signal */}
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className="h-5 bg-border/40 rounded-full w-20" />
        <div className="h-3 bg-border/30 rounded w-48" />
      </div>

      {/* Chart area */}
      <div className="rounded-lg bg-border/20 h-[220px] sm:h-[280px]" />

      {/* Table skeleton */}
      <div className="mt-3 sm:mt-4 space-y-2">
        <div className="h-3 bg-border/30 rounded w-40" />
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-border/20 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <header className="mb-5 sm:mb-8 animate-pulse">
        <div className="h-8 sm:h-9 bg-border/60 rounded w-48" />
        <div className="h-4 bg-border/40 rounded w-64 mt-2" />
      </header>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPanel key={i} />
        ))}
      </div>
    </main>
  );
}

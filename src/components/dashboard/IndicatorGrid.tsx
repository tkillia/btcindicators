import type { IndicatorResult } from "@/lib/indicators/types";
import { IndicatorPanel } from "./IndicatorPanel";

interface Props {
  results: IndicatorResult[];
}

export function IndicatorGrid({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted text-sm">
          No indicators loaded. Check API connections.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
      {results.map((result) => (
        <div
          key={result.id}
          className={result.id === "cycle-composite" ? "md:col-span-2" : ""}
        >
          <IndicatorPanel result={result} />
        </div>
      ))}
    </div>
  );
}

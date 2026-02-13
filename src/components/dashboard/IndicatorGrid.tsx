import type { IndicatorResult } from "@/lib/indicators/types";
import { IndicatorPanel } from "./IndicatorPanel";

interface Props {
  results: IndicatorResult[];
}

export function IndicatorGrid({ results }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {results.map((result) => (
        <IndicatorPanel key={result.id} result={result} />
      ))}
    </div>
  );
}

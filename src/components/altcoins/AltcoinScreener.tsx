"use client";

import { AltcoinScreenerData } from "@/lib/altcoins/types";
import { TokenTable } from "./TokenTable";

interface Props {
  data: AltcoinScreenerData;
}

export function AltcoinScreener({ data }: Props) {
  const notable = data.tokens.filter(
    (t) => t.oiZScore > 2 || t.relativeStrength > 2
  );

  return (
    <div>
      <header className="mb-5 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Altcoin Screener
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-1">
          Top {data.tokens.length} by futures volume · BTC 7d:{" "}
          <span className={data.btcChange7d >= 0 ? "text-buy" : "text-sell"}>
            {data.btcChange7d >= 0 ? "+" : ""}
            {data.btcChange7d.toFixed(1)}%
          </span>{" "}
          · Updated {data.lastUpdated}
        </p>
      </header>

      {notable.length > 0 && (
        <div className="mb-3 sm:mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm text-accent-amber font-medium">
            ⚡ Notable movers: {notable.map((t) => t.symbol).join(", ")}
          </p>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            OI z-score &gt; 2 or relative strength &gt; 2x BTC
          </p>
        </div>
      )}

      <TokenTable tokens={data.tokens} />
    </div>
  );
}

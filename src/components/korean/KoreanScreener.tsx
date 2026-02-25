"use client";

import { KoreanScreenerData } from "@/lib/korean/types";
import { KoreanTable } from "./KoreanTable";
import { RefreshButton } from "@/components/shared/RefreshButton";

interface Props {
  data: KoreanScreenerData;
}

export function KoreanScreener({ data }: Props) {
  const highPremium = data.tokens.filter((t) => Math.abs(t.kimchiPremium) > 3);
  const highVolMcap = data.tokens.filter((t) => t.volumeToMcap > 0.1);

  return (
    <div>
      <header className="mb-5 sm:mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Korean Alts Screener
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            {data.tokens.length} tokens on Upbit/Bithumb · BTC Kimchi Premium:{" "}
            <span
              className={
                data.btcKimchiPremium >= 0 ? "text-buy" : "text-sell"
              }
            >
              {data.btcKimchiPremium >= 0 ? "+" : ""}
              {data.btcKimchiPremium.toFixed(2)}%
            </span>{" "}
            · KRW/USD: ₩{data.impliedKrwUsd.toFixed(0)} · Updated{" "}
            {data.lastUpdated}
          </p>
        </div>
        <RefreshButton />
      </header>

      {highPremium.length > 0 && (
        <div className="mb-3 sm:mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm text-accent-amber font-medium">
            🇰🇷 High kimchi premium:{" "}
            {highPremium
              .map(
                (t) =>
                  `${t.symbol} (${t.kimchiPremium >= 0 ? "+" : ""}${t.kimchiPremium.toFixed(1)}%)`
              )
              .join(", ")}
          </p>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            Premium &gt; 3% vs global price (relative to BTC)
          </p>
        </div>
      )}

      {highVolMcap.length > 0 && (
        <div className="mb-3 sm:mb-4 rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm text-accent-blue font-medium">
            📊 Korean favorites (high Vol/MCap):{" "}
            {highVolMcap
              .map(
                (t) =>
                  `${t.symbol} (${(t.volumeToMcap * 100).toFixed(1)}%)`
              )
              .join(", ")}
          </p>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            Korean KRW volume &gt; 10% of market cap — heavy Korean trading
            interest
          </p>
        </div>
      )}

      <KoreanTable tokens={data.tokens} />
    </div>
  );
}

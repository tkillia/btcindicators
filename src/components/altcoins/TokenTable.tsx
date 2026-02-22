"use client";

import { useState } from "react";
import { AltcoinToken } from "@/lib/altcoins/types";

type SortKey = keyof AltcoinToken;
type SortDir = "asc" | "desc";

interface Props {
  tokens: AltcoinToken[];
}

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "symbol", label: "Token" },
  { key: "price", label: "Price", align: "right" },
  { key: "priceChange24h", label: "24h %", align: "right" },
  { key: "priceChange7d", label: "7d %", align: "right" },
  { key: "openInterest", label: "OI", align: "right" },
  { key: "oiChange24h", label: "OI 24h%", align: "right" },
  { key: "oiZScore", label: "OI Z", align: "right" },
  { key: "fundingApr", label: "Fund APR", align: "right" },
  { key: "relativeStrength", label: "RS", align: "right" },
  { key: "fdv", label: "FDV", align: "right" },
  { key: "breakoutScore", label: "Score", align: "right" },
];

export function TokenTable({ tokens }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("breakoutScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const sorted = [...tokens].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc"
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    }
    const diff = (av as number) - (bv as number);
    return sortDir === "asc" ? diff : -diff;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-2 sm:px-3 py-2 font-medium text-muted cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${sortKey === col.key ? "text-foreground" : ""}`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((token, i) => (
            <tr
              key={token.symbol}
              className={`border-b border-border/50 hover:bg-card/80 transition-colors ${
                i % 2 === 0 ? "bg-background" : "bg-card/30"
              }`}
            >
              <td className="px-2 sm:px-3 py-1.5 font-semibold text-foreground whitespace-nowrap">
                {token.oiZScore > 2 || token.relativeStrength > 2 ? (
                  <span className="text-accent-amber mr-1">⚡</span>
                ) : null}
                {token.symbol}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatPrice(token.price)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${pctColor(token.priceChange24h)}`}>
                {fmtPct(token.priceChange24h)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${pctColor(token.priceChange7d)}`}>
                {fmtPct(token.priceChange7d)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatCompact(token.openInterest)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${pctColor(token.oiChange24h)}`}>
                {fmtPct(token.oiChange24h)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${zColor(token.oiZScore)}`}>
                {token.oiZScore.toFixed(1)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${pctColor(token.fundingApr)}`}>
                {fmtPct(token.fundingApr)}
              </td>
              <td className={`px-2 sm:px-3 py-1.5 text-right font-mono ${rsColor(token.relativeStrength)}`}>
                {token.relativeStrength.toFixed(2)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatCompact(token.fdv)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono font-semibold text-accent-amber">
                {token.breakoutScore.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Formatting helpers ---

function formatPrice(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toPrecision(3)}`;
}

function formatCompact(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function pctColor(v: number): string {
  if (v > 0) return "text-buy";
  if (v < 0) return "text-sell";
  return "text-muted";
}

function zColor(z: number): string {
  if (z > 1.5) return "text-buy";
  if (z < -1.5) return "text-sell";
  return "text-muted";
}

function rsColor(rs: number): string {
  if (rs > 1.5) return "text-buy";
  if (rs < 0.5) return "text-sell";
  return "text-muted";
}

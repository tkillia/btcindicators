"use client";

import { useState } from "react";
import { KoreanToken } from "@/lib/korean/types";

type SortKey = keyof KoreanToken;
type SortDir = "asc" | "desc";

interface Props {
  tokens: KoreanToken[];
}

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "symbol", label: "Token" },
  { key: "krwPrice", label: "KRW Price", align: "right" },
  { key: "usdPrice", label: "USD Price", align: "right" },
  { key: "kimchiPremium", label: "Premium", align: "right" },
  { key: "priceChange24h", label: "24h %", align: "right" },
  { key: "upbitVolume24h", label: "Upbit Vol", align: "right" },
  { key: "bithumbVolume24h", label: "Bithumb Vol", align: "right" },
  { key: "totalKrwVolume", label: "Total KRW Vol", align: "right" },
  { key: "volumeToMcap", label: "Vol/MCap", align: "right" },
  { key: "marketCap", label: "MCap", align: "right" },
];

export function KoreanTable({ tokens }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("totalKrwVolume");
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
                {Math.abs(token.kimchiPremium) > 3 && (
                  <span className="text-accent-amber mr-1">🇰🇷</span>
                )}
                {token.symbol}
                <span className="ml-1.5 text-muted font-normal text-[11px] hidden sm:inline">
                  {token.name}
                </span>
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatKrw(token.krwPrice)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatUsd(token.usdPrice)}
              </td>
              <td
                className={`px-2 sm:px-3 py-1.5 text-right font-mono font-semibold ${premiumColor(token.kimchiPremium)}`}
              >
                {fmtPct(token.kimchiPremium)}
              </td>
              <td
                className={`px-2 sm:px-3 py-1.5 text-right font-mono ${pctColor(token.priceChange24h)}`}
              >
                {fmtPct(token.priceChange24h)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatKrwCompact(token.upbitVolume24h)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatKrwCompact(token.bithumbVolume24h)}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground font-semibold">
                {formatKrwCompact(token.totalKrwVolume)}
              </td>
              <td
                className={`px-2 sm:px-3 py-1.5 text-right font-mono ${volMcapColor(token.volumeToMcap)}`}
              >
                {(token.volumeToMcap * 100).toFixed(2)}%
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right font-mono text-foreground">
                {formatCompact(token.marketCap)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Formatting helpers ---

function formatKrw(v: number): string {
  if (v >= 1000) return `₩${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `₩${v.toFixed(1)}`;
  return `₩${v.toPrecision(3)}`;
}

function formatKrwCompact(v: number): string {
  if (v >= 1e12) return `₩${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `₩${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e8) return `₩${(v / 1e8).toFixed(0)}억`;
  if (v >= 1e6) return `₩${(v / 1e6).toFixed(0)}M`;
  return `₩${v.toFixed(0)}`;
}

function formatUsd(v: number): string {
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
  return `${sign}${v.toFixed(2)}%`;
}

function pctColor(v: number): string {
  if (v > 0) return "text-buy";
  if (v < 0) return "text-sell";
  return "text-muted";
}

function premiumColor(v: number): string {
  if (v > 3) return "text-accent-amber";
  if (v > 1) return "text-buy";
  if (v < -1) return "text-sell";
  return "text-muted";
}

function volMcapColor(v: number): string {
  if (v > 0.1) return "text-accent-amber";
  if (v > 0.05) return "text-buy";
  return "text-muted";
}

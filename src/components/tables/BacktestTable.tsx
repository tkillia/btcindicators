import type { BacktestRow } from "@/lib/indicators/types";

interface Props {
  title: string;
  columns: string[];
  rows: BacktestRow[];
}

function getCellColor(value: string | number): string {
  const str = String(value);
  if (str.startsWith("+")) return "text-buy";
  if (str.startsWith("-")) return "text-sell";
  if (str === "?" || str === "Active" || str === "Not yet touched")
    return "text-neutral";
  return "text-foreground";
}

export function BacktestTable({ title, columns, rows }: Props) {
  return (
    <div className="mt-3 sm:mt-4">
      <h3 className="text-[11px] sm:text-xs font-medium tracking-wider text-muted mb-2">
        Backtest: {title}
      </h3>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="py-1.5 sm:py-2 px-2 sm:px-3 text-left text-[10px] sm:text-xs font-semibold tracking-wider text-muted whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const values = Object.values(row);
              const isLast = rowIdx === rows.length - 1;
              return (
                <tr
                  key={rowIdx}
                  className={`border-b border-border/40 ${
                    isLast
                      ? "bg-accent-blue/10"
                      : rowIdx % 2 === 0
                        ? "bg-card"
                        : ""
                  }`}
                >
                  {values.map((val, colIdx) => (
                    <td
                      key={colIdx}
                      className={`py-1.5 sm:py-2 px-2 sm:px-3 font-mono text-xs whitespace-nowrap ${getCellColor(
                        val
                      )}`}
                    >
                      {String(val ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

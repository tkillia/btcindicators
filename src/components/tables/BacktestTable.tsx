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
  const columnKeys = columns.map((_, i) => i);

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
        Backtest: {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
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
                  className={`border-b border-border/50 ${
                    isLast ? "bg-accent-blue/5" : rowIdx % 2 === 0 ? "bg-card" : ""
                  }`}
                >
                  {columnKeys.map((colIdx) => (
                    <td
                      key={colIdx}
                      className={`py-2 px-3 font-mono text-sm ${getCellColor(
                        values[colIdx]
                      )}`}
                    >
                      {String(values[colIdx] ?? "")}
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

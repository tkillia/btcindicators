interface Props {
  signal: "buy" | "neutral" | "sell";
}

const styles = {
  buy: "bg-buy/15 text-buy border-buy/50",
  neutral: "bg-neutral/15 text-neutral border-neutral/50",
  sell: "bg-sell/15 text-sell border-sell/50",
};

const labels = {
  buy: "Buy Zone",
  neutral: "Normal",
  sell: "Sell Zone",
};

export function Badge({ signal }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${styles[signal]}`}
    >
      {labels[signal]}
    </span>
  );
}

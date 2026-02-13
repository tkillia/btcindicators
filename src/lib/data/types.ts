export interface DailyPrice {
  /** Unix timestamp in seconds */
  timestamp: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

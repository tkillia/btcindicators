/**
 * Simple Moving Average.
 * Returns an array of the same length as input, with NaN for indices
 * where the window is not yet full.
 */
export function sma(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }

  return result;
}

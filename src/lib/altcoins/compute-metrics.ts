import { AltcoinToken } from "./types";

/**
 * Z-score of latest OI value relative to its 30d history.
 * Positive = OI above average (accumulation), negative = below.
 */
export function computeOiZScore(oiValues: number[]): number {
  if (oiValues.length < 5) return 0;
  const mean = oiValues.reduce((s, v) => s + v, 0) / oiValues.length;
  const variance =
    oiValues.reduce((s, v) => s + (v - mean) ** 2, 0) / oiValues.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return (oiValues[oiValues.length - 1] - mean) / stddev;
}

/**
 * Composite breakout score (0–10 scale).
 * Weights: OI z-score 30%, RS 25%, funding 20%, price momentum 15%, volume rank 10%.
 */
export function computeBreakoutScore(token: AltcoinToken): number {
  // OI z-score component (0–10): z > 2 is max, z < -1 is 0
  const oiComponent = clamp((token.oiZScore + 1) / 3, 0, 1) * 10;

  // Relative strength component (0–10): RS > 2 is max
  const rsComponent = clamp(token.relativeStrength / 2, 0, 1) * 10;

  // Funding component (0–10): extreme positive funding = overheated (lower score)
  // Slightly negative funding with price rising = best setup
  const fundingNorm = clamp(1 - Math.abs(token.fundingApr) / 100, 0, 1) * 10;

  // Price momentum (0–10): 7d change
  const momentumComponent =
    clamp((token.priceChange7d + 10) / 30, 0, 1) * 10;

  // Volume is implicitly handled by selection (top 40 by volume)
  const volumeComponent = 5; // baseline since all are high-volume

  return (
    oiComponent * 0.3 +
    rsComponent * 0.25 +
    fundingNorm * 0.2 +
    momentumComponent * 0.15 +
    volumeComponent * 0.1
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

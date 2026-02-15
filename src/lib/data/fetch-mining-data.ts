export interface MiningDataPoint {
  timestamp: number;
  date: string;
  hashrate: number; // TH/s
  difficulty: number;
  estimatedCost: number; // USD per BTC
}

interface BlockchainChartResponse {
  values: Array<{ x: number; y: number }>;
}

async function fetchBlockchainChart(
  chart: string,
  timespan = "3years"
): Promise<Array<{ timestamp: number; date: string; value: number }>> {
  const res = await fetch(
    `https://api.blockchain.info/charts/${chart}?timespan=${timespan}&format=json&sampled=true`,
    { next: { tags: ["mining-data"], revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`Blockchain.info ${chart} error: ${res.status}`);

  const json: BlockchainChartResponse = await res.json();
  if (!Array.isArray(json?.values)) return [];

  return json.values.map((v) => ({
    timestamp: v.x,
    date: new Date(v.x * 1000).toISOString().split("T")[0],
    value: v.y,
  }));
}

/**
 * Estimate BTC mining cost from hashrate and difficulty.
 *
 * Model: cost = (hashrate_TH * watts_per_TH * 24h * electricity_rate) / daily_btc_mined
 *
 * Assumptions (approximate industry average):
 * - Modern ASIC efficiency: ~25 J/TH (Antminer S21 class)
 * - Average electricity: $0.05/kWh
 * - Block reward: 3.125 BTC (post-April 2024 halving)
 * - ~144 blocks/day = 450 BTC/day
 */
const JOULES_PER_TH = 25;
const ELECTRICITY_RATE = 0.05; // $/kWh
const DAILY_BTC_MINED = 450; // 3.125 BTC × 144 blocks

export async function fetchMiningCost(): Promise<MiningDataPoint[]> {
  const [hashData, diffData] = await Promise.all([
    fetchBlockchainChart("hash-rate", "3years"),
    fetchBlockchainChart("difficulty", "3years"),
  ]);

  // Build difficulty lookup by date
  const diffByDate = new Map(diffData.map((d) => [d.date, d.value]));

  return hashData.map((h) => {
    const hashrateTH = h.value; // already in TH/s
    const difficulty = diffByDate.get(h.date) ?? 0;

    // Network power consumption: hashrate(TH/s) × J/TH = Watts
    // Daily energy: Watts × 24h / 1000 = kWh
    // Daily cost: kWh × electricity rate
    // Cost per BTC: daily cost / daily BTC mined
    const networkWatts = hashrateTH * JOULES_PER_TH;
    const dailyKWh = (networkWatts * 24) / 1000;
    const dailyCost = dailyKWh * ELECTRICITY_RATE;
    const costPerBTC = dailyCost / DAILY_BTC_MINED;

    return {
      timestamp: h.timestamp,
      date: h.date,
      hashrate: hashrateTH,
      difficulty,
      estimatedCost: costPerBTC,
    };
  });
}

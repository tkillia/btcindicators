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
  timespan = "5years"
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
 * - Block reward adjusts per halving schedule
 * - ~144 blocks/day
 */
const JOULES_PER_TH = 25;
const ELECTRICITY_RATE = 0.05; // $/kWh
const BLOCKS_PER_DAY = 144;

// BTC halving dates (approximate) and block rewards
const HALVINGS: Array<{ date: string; reward: number }> = [
  { date: "2012-11-28", reward: 25 },
  { date: "2016-07-09", reward: 12.5 },
  { date: "2020-05-11", reward: 6.25 },
  { date: "2024-04-20", reward: 3.125 },
];

function getDailyBtcMined(date: string): number {
  let reward = 50; // pre-first-halving
  for (const h of HALVINGS) {
    if (date >= h.date) reward = h.reward;
  }
  return reward * BLOCKS_PER_DAY;
}

export async function fetchMiningCost(): Promise<MiningDataPoint[]> {
  const [hashData, diffData] = await Promise.all([
    fetchBlockchainChart("hash-rate", "5years"),
    fetchBlockchainChart("difficulty", "5years"),
  ]);

  // Build difficulty lookup by date
  const diffByDate = new Map(diffData.map((d) => [d.date, d.value]));

  return hashData.map((h) => {
    const hashrateTH = h.value; // already in TH/s
    const difficulty = diffByDate.get(h.date) ?? 0;
    const dailyBtcMined = getDailyBtcMined(h.date);

    // Network power consumption: hashrate(TH/s) × J/TH = Watts
    // Daily energy: Watts × 24h / 1000 = kWh
    // Daily cost: kWh × electricity rate
    // Cost per BTC: daily cost / daily BTC mined
    const networkWatts = hashrateTH * JOULES_PER_TH;
    const dailyKWh = (networkWatts * 24) / 1000;
    const dailyCost = dailyKWh * ELECTRICITY_RATE;
    const costPerBTC = dailyBtcMined > 0 ? dailyCost / dailyBtcMined : 0;

    return {
      timestamp: h.timestamp,
      date: h.date,
      hashrate: hashrateTH,
      difficulty,
      estimatedCost: costPerBTC,
    };
  });
}

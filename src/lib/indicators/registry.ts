import { Indicator } from "./types";
import { CycleComposite } from "./cycle-composite";
import { MayerMultiple } from "./mayer-multiple";
import { TwoHundredWMA } from "./two-hundred-wma";
import { StablecoinSupply } from "./stablecoin-supply";
import { BinanceCoinbaseGap } from "./binance-coinbase-gap";
import { BitfinexLongs } from "./bitfinex-longs";
import { DeribitOptions } from "./deribit-options";
import { MiningCost } from "./mining-cost";

export const indicators: Indicator[] = [
  new CycleComposite(),
  new MayerMultiple(),
  new TwoHundredWMA(),
  new StablecoinSupply(),
  new BinanceCoinbaseGap(),
  new BitfinexLongs(),
  new DeribitOptions(),
  new MiningCost(),
];

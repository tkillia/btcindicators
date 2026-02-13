import { Indicator } from "./types";
import { MayerMultiple } from "./mayer-multiple";
import { TwoHundredWMA } from "./two-hundred-wma";
import { StablecoinSupply } from "./stablecoin-supply";
import { BinanceCoinbaseGap } from "./binance-coinbase-gap";

export const indicators: Indicator[] = [
  new MayerMultiple(),
  new TwoHundredWMA(),
  new StablecoinSupply(),
  new BinanceCoinbaseGap(),
];

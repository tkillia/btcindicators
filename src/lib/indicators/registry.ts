import { Indicator } from "./types";
import { MayerMultiple } from "./mayer-multiple";
import { TwoHundredWMA } from "./two-hundred-wma";
import { StablecoinSupply } from "./stablecoin-supply";

export const indicators: Indicator[] = [
  new MayerMultiple(),
  new TwoHundredWMA(),
  new StablecoinSupply(),
];

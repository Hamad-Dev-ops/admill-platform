import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

export class DemandFactor implements IPricingFactor {
  name = "demand";

  calculate(context: IPricingContext): IFactorResult {
    const amount = context.demandRatio * context.maxDemandSurcharge;

    return {
      name: this.name,
      amount,
      description: `Demand surcharge (${Math.round(context.demandRatio * 100)}% demand pressure)`,
    };
  }
}

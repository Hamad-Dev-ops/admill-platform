import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

export class DistanceFactor implements IPricingFactor {
  name = "distance";

  calculate(context: IPricingContext): IFactorResult {
    const amount = context.distanceKm * context.perKmRate;

    return {
      name: this.name,
      amount,
      description: `${context.distanceKm.toFixed(1)}km at ${context.perKmRate} AED/km`,
    };
  }
}

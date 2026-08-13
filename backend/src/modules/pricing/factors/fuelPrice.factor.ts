import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

export class FuelPriceFactor implements IPricingFactor {
  name = "fuelPrice";

  calculate(context: IPricingContext): IFactorResult {
    const litersUsed = context.distanceKm * context.fuelConsumptionPerKm;
    const amount = litersUsed * context.currentFuelPrice;

    return {
      name: this.name,
      amount,
      description: `${litersUsed.toFixed(2)}L at ${context.currentFuelPrice} AED/L`,
    };
  }
}

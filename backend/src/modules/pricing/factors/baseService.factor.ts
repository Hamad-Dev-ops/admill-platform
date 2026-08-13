import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

export class BaseServiceFactor implements IPricingFactor {
  name = "baseService";

  calculate(context: IPricingContext): IFactorResult {
    return {
      name: this.name,
      amount: context.baseFare,
      description: `Base fare for ${context.serviceType}`,
    };
  }
}

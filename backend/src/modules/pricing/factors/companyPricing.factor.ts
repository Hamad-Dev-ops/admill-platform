import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

// Stub — Service and PricingConfig are deliberately global for the MVP. This factor
// (and IPricingConfig's own comment) is the seam for company-specific pricing later:
// a company override lookup slots in here with zero changes to PricingService or any
// other factor. Not registered in the active factor list.
export class CompanyPricingFactor implements IPricingFactor {
  name = "companyPricing";

  calculate(_context: IPricingContext): IFactorResult {
    return {
      name: this.name,
      amount: 0,
      description: "Company-specific pricing not yet active",
    };
  }
}

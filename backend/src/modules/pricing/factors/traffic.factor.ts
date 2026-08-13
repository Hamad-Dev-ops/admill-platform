import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

// Stub — no free/reliable traffic API exists for production use today (evaluated and
// rejected, see PROGRESS.md). Not registered in PricingService's active factor list;
// exists so a real implementation later is "add logic here", not "design a new factor".
export class TrafficFactor implements IPricingFactor {
  name = "traffic";

  calculate(_context: IPricingContext): IFactorResult {
    return {
      name: this.name,
      amount: 0,
      description: "Traffic pricing not yet active",
    };
  }
}

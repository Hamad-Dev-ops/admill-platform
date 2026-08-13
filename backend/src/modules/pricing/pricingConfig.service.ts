import { invalidateFuelPriceCache } from "../../infrastructure/providers/fuelPrice/config.provider";
import { PricingConfigRepository } from "../../repositories/pricingConfig.repository";
import { UpdatePricingConfigInput } from "./pricing.validator";

export const PricingConfigService = {
  async getActive() {
    return PricingConfigRepository.findActiveOrCreateDefault();
  },

  /**
   * Creates a new version rather than mutating the active one, so historical fare
   * calculations remain explainable against the config that was actually active at
   * the time (e.g. reconciling what a customer was quoted last month).
   *
   * The actual deactivate-then-create transition lives in
   * PricingConfigRepository.createNewVersionFrom — shared with the automatic
   * external fuel-price sync path in ConfigFuelPriceProvider, so there's exactly one
   * place that logic exists regardless of what triggered the change.
   *
   * Known limitation: that transition isn't wrapped in a DB transaction, so a failure
   * between the two steps could briefly leave zero active configs — acceptable for
   * how rarely this runs, flagged rather than silently accepted.
   */
  async createNewVersion(input: UpdatePricingConfigInput) {
    const current = await PricingConfigRepository.findActiveOrCreateDefault();

    // Bust the cache in fuelPriceProvider explicitly — see its own comment on why a
    // 24h cache and "changes take effect immediately" would otherwise conflict.
    await invalidateFuelPriceCache();

    return PricingConfigRepository.createNewVersionFrom(current, input);
  },
};

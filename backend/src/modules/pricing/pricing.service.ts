import { ServiceType } from "../../constants/service.enum";
import { AppError } from "../../errors/AppError";
import { distanceProvider } from "../../infrastructure/providers/distance/openRouteService.provider";
import { fuelPriceProvider } from "../../infrastructure/providers/fuelPrice/config.provider";
import { weatherProvider } from "../../infrastructure/providers/weather/openWeatherMap.provider";
import { IGeoPoint } from "../../interfaces/geo.interface";
import { ServiceRepository } from "../../repositories/service.repository";
import { DemandEstimator } from "./demandEstimator.service";
import { BaseServiceFactor } from "./factors/baseService.factor";
import { DemandFactor } from "./factors/demand.factor";
import { DistanceFactor } from "./factors/distance.factor";
import { FuelPriceFactor } from "./factors/fuelPrice.factor";
import { TimeFactor } from "./factors/time.factor";
import { IFareBreakdown, IPricingContext, IPricingFactor } from "./factors/types";
import { WeatherFactor } from "./factors/weather.factor";
import { PricingConfigService } from "./pricingConfig.service";
import { Checkpoint, logCheckpoint } from "../../utils/checkpoint";

// The Strategy list. Adding a factor later means adding one line here — nothing else
// in this file changes, which is the actual acceptance test for the whole pattern.
// TrafficFactor and CompanyPricingFactor stay out of this list until they have a real
// implementation behind them (see their own files for why).
export const activeFactors: IPricingFactor[] = [
  new BaseServiceFactor(),
  new DistanceFactor(),
  new FuelPriceFactor(),
  new WeatherFactor(),
  new TimeFactor(),
  new DemandFactor(),
];

// Exported separately from PricingService so it can be exercised directly with an
// arbitrary factor list — this is what makes "adding a 6th factor requires no changes
// elsewhere" a real, testable claim rather than an assertion about code we can't run.
export function runFactors(factors: IPricingFactor[], context: IPricingContext): IFareBreakdown {
  const results = factors.map((factor) => factor.calculate(context));
  const total = Math.round(results.reduce((sum, factor) => sum + factor.amount, 0) * 100) / 100;

  return {
    serviceType: context.serviceType,
    distanceKm: context.distanceKm,
    durationMinutes: context.durationMinutes,
    factors: results,
    total,
  };
}

export const PricingService = {
  async calculateFare(
    serviceType: ServiceType,
    pickupLocation: IGeoPoint,
    destinationLocation: IGeoPoint
  ): Promise<IFareBreakdown> {
    logCheckpoint(Checkpoint.PRICING_ESTIMATE_RECEIVED, { serviceType });
    try {
      const service = await ServiceRepository.findByType(serviceType);

      if (!service || !service.isAvailable) {
        throw new AppError(404, "This service is not currently available");
      }

      const pricingConfig = await PricingConfigService.getActive();

      const [route, weather, currentFuelPrice, demand] = await Promise.all([
        distanceProvider.getRoute(pickupLocation, destinationLocation),
        weatherProvider.getCurrentCondition(pickupLocation),
        fuelPriceProvider.getCurrentFuelPrice(),
        DemandEstimator.getSnapshot(pricingConfig.lowSupplyThreshold),
      ]);

      const context: IPricingContext = {
        serviceType,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        timestamp: new Date(),
        baseFare: service.baseFare,
        currentFuelPrice,
        fuelConsumptionPerKm: pricingConfig.fuelConsumptionPerKm,
        perKmRate: pricingConfig.perKmRate,
        peakHourWindows: pricingConfig.peakHourWindows,
        peakHourSurcharge: pricingConfig.peakHourSurcharge,
        demandRatio: demand.demandRatio,
        maxDemandSurcharge: pricingConfig.maxDemandSurcharge,
        weatherCondition: weather.condition,
      };

      const breakdown = runFactors(activeFactors, context);
      logCheckpoint(Checkpoint.PRICING_ESTIMATE_SUCCESS, {
        serviceType,
        distanceKm: breakdown.distanceKm,
        total: breakdown.total,
      });
      return breakdown;
    } catch (err) {
      logCheckpoint(
        Checkpoint.PRICING_ESTIMATE_FAILURE,
        { serviceType, message: err instanceof Error ? err.message : "pricing failed" },
        "warn"
      );
      throw err;
    }
  },
};

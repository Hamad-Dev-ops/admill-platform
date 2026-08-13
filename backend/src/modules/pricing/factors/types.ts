import { ServiceType } from "../../../constants/service.enum";
import { IPeakHourWindow } from "../../../interfaces/pricingConfig.interface";
import { WeatherCondition } from "../../../infrastructure/providers/weather/weather.provider.interface";

/**
 * Fully resolved before any factor runs — PricingService is the only place that talks
 * to repositories/providers. Every factor is a pure, synchronous function of this
 * context alone, which is what makes "unit-test a factor with a mocked context"
 * actually true rather than aspirational.
 */
export interface IPricingContext {
  serviceType: ServiceType;
  distanceKm: number;
  durationMinutes: number; // informational (ETA) — no active factor prices on this yet
  timestamp: Date;

  baseFare: number;
  currentFuelPrice: number;
  fuelConsumptionPerKm: number;
  perKmRate: number;
  peakHourWindows: IPeakHourWindow[];
  peakHourSurcharge: number;
  demandRatio: number;
  maxDemandSurcharge: number;
  weatherCondition: WeatherCondition;
}

export interface IFactorResult {
  name: string;
  amount: number;
  description: string;
}

// The Strategy pattern contract — PricingService only ever calls `.calculate()`, never
// knows or cares how a factor computes its number.
export interface IPricingFactor {
  name: string;
  calculate(context: IPricingContext): IFactorResult;
}

export interface IFareBreakdown {
  serviceType: ServiceType;
  distanceKm: number;
  durationMinutes: number;
  factors: IFactorResult[];
  total: number;
}

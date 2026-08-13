import { WeatherCondition } from "../../../infrastructure/providers/weather/weather.provider.interface";
import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

// Flat AED surcharges by condition — simple constants for now, not sourced from
// PricingConfig (which only names fuel price/peak-hour/demand fields); easy to move
// there later if that becomes a real business lever.
const WEATHER_SURCHARGE: Record<WeatherCondition, number> = {
  CLEAR: 0,
  RAIN: 10,
  EXTREME: 20,
  STORM: 25,
};

export class WeatherFactor implements IPricingFactor {
  name = "weather";

  calculate(context: IPricingContext): IFactorResult {
    const amount = WEATHER_SURCHARGE[context.weatherCondition];

    return {
      name: this.name,
      amount,
      description: `Weather surcharge (${context.weatherCondition.toLowerCase()})`,
    };
  }
}

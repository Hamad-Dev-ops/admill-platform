import { IGeoPoint } from "../../../interfaces/geo.interface";

// EXTREME covers UAE-relevant hazards OpenWeatherMap classifies outside rain/storm —
// dust, sand, and fog conditions common in the region that materially affect towing ops.
export type WeatherCondition = "CLEAR" | "RAIN" | "STORM" | "EXTREME";

export interface IWeatherSnapshot {
  condition: WeatherCondition;
  description: string;
}

export interface IWeatherProvider {
  getCurrentCondition(point: IGeoPoint): Promise<IWeatherSnapshot>;
}

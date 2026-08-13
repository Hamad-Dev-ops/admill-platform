import { cacheProvider } from "../../cache/inMemoryCache.provider";
import { env } from "../../../config/env";
import { IGeoPoint } from "../../../interfaces/geo.interface";
import { logger } from "../../../utils/logger";
import { IWeatherProvider, IWeatherSnapshot, WeatherCondition } from "./weather.provider.interface";

const CACHE_TTL_MS = 12 * 60 * 1000; // within the requested 10-15 minute window

function mapWeatherCodeToCondition(code: number): WeatherCondition {
  if (code >= 200 && code < 300) return "STORM";
  if (code >= 300 && code < 700) return "RAIN"; // drizzle, rain, snow — all wet-road hazards
  if (code >= 700 && code < 800) return "EXTREME"; // mist/haze/dust/sand/fog — common in UAE
  return "CLEAR"; // 800 clear, 80x clouds
}

function cacheKey(point: IGeoPoint): string {
  const [lon, lat] = point.coordinates;
  // Rounded to ~1.1km grid so nearby pickups share a cache entry instead of each
  // producing a unique key.
  return `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export class OpenWeatherMapProvider implements IWeatherProvider {
  async getCurrentCondition(point: IGeoPoint): Promise<IWeatherSnapshot> {
    const key = cacheKey(point);
    const cached = await cacheProvider.get<IWeatherSnapshot>(key);

    if (cached) {
      return cached;
    }

    const snapshot = await this.fetchFromApi(point);
    await cacheProvider.set(key, snapshot, CACHE_TTL_MS);

    return snapshot;
  }

  private async fetchFromApi(point: IGeoPoint): Promise<IWeatherSnapshot> {
    const [lon, lat] = point.coordinates;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}`;

    try {
      const res = await fetch(url);

      if (!res.ok) {
        logger.warn({ status: res.status }, "OpenWeatherMap request failed, defaulting to CLEAR");
        return { condition: "CLEAR", description: "Weather lookup unavailable" };
      }

      const data = (await res.json()) as { weather?: { id: number; description: string }[] };
      const code = data.weather?.[0]?.id;
      const description = data.weather?.[0]?.description ?? "unknown";

      if (typeof code !== "number") {
        logger.warn("OpenWeatherMap response missing weather code, defaulting to CLEAR");
        return { condition: "CLEAR", description: "Weather lookup unavailable" };
      }

      return { condition: mapWeatherCodeToCondition(code), description };
    } catch (err) {
      // Best-effort, same philosophy as FCM push in §16: a failed weather lookup
      // must never block a fare estimate.
      logger.warn({ err }, "OpenWeatherMap request threw, defaulting to CLEAR");
      return { condition: "CLEAR", description: "Weather lookup unavailable" };
    }
  }
}

export const weatherProvider: IWeatherProvider = new OpenWeatherMapProvider();

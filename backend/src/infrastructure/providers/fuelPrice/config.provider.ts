import { env } from "../../../config/env";
import { PricingConfigRepository } from "../../../repositories/pricingConfig.repository";
import { logger } from "../../../utils/logger";
import { cacheProvider } from "../../cache/inMemoryCache.provider";
import { IFuelPriceProvider } from "./fuelPrice.provider.interface";

const CACHE_KEY = "fuelPrice:current";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface IExternalFuelPriceResponse {
  price?: number;
}

/**
 * Placeholder contract for "a configurable external fuel-price source" — no concrete
 * reliable free provider exists today (evaluated and rejected, see PROGRESS.md), so
 * this assumes a minimal `{ price: number }` JSON shape. Wiring in a real API later
 * means writing an adapter to this shape, not changing the provider or the factor.
 */
async function fetchFromExternalSource(): Promise<number> {
  const res = await fetch(env.FUEL_PRICE_EXTERNAL_API_URL as string);

  if (!res.ok) {
    throw new Error(`External fuel price source returned ${res.status}`);
  }

  const data = (await res.json()) as IExternalFuelPriceResponse;

  if (typeof data.price !== "number") {
    throw new Error("External fuel price source returned an unexpected response shape");
  }

  return data.price;
}

/**
 * Hybrid strategy: try a configurable external source if one is set up; on success,
 * persist it as a new PricingConfig version (but only if the price actually changed,
 * so routine syncs don't pollute history with no-op versions); on any failure — or if
 * no external source is configured at all — fall back to the last stored value.
 * A fuel-price lookup must never fail the fare estimate.
 *
 * The external fetch is constructor-injected so this fallback behavior is
 * deterministically unit-testable without a real network call or a real key.
 */
export class ConfigFuelPriceProvider implements IFuelPriceProvider {
  constructor(
    private readonly externalFetch: typeof fetchFromExternalSource = fetchFromExternalSource,
    // Injectable separately from the env check itself — otherwise a test environment
    // with no real URL set could never exercise the "external source configured" branch.
    private readonly hasExternalSource: boolean = Boolean(env.FUEL_PRICE_EXTERNAL_API_URL)
  ) {}

  async getCurrentFuelPrice(): Promise<number> {
    const cached = await cacheProvider.get<number>(CACHE_KEY);

    if (cached !== undefined) {
      return cached;
    }

    const current = await PricingConfigRepository.findActiveOrCreateDefault();
    let price = current.currentFuelPrice;

    if (this.hasExternalSource) {
      try {
        const fetched = await this.externalFetch();

        if (fetched !== current.currentFuelPrice) {
          await PricingConfigRepository.createNewVersionFrom(current, { currentFuelPrice: fetched });
        }

        price = fetched;
      } catch (err) {
        logger.warn({ err }, "External fuel price fetch failed, falling back to last stored value");
      }
    }

    await cacheProvider.set(CACHE_KEY, price, CACHE_TTL_MS);

    return price;
  }
}

export const fuelPriceProvider: IFuelPriceProvider = new ConfigFuelPriceProvider();

/**
 * The 24h cache and "a config change affects the next estimate immediately" are in
 * real tension — without this, a fuel price update would silently sit uncached for up
 * to 24h before taking effect. PricingConfigService calls this after creating a new
 * version so both requirements hold: cheap cached reads day-to-day, immediate effect
 * the moment someone actually changes the price.
 */
export async function invalidateFuelPriceCache(): Promise<void> {
  await cacheProvider.delete(CACHE_KEY);
}

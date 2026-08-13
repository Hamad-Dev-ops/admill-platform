import { ICacheProvider } from "./cache.provider.interface";

interface ICacheEntry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryCacheProvider implements ICacheProvider {
  private store = new Map<string, ICacheEntry>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Single process-wide instance — swapping to Redis later is a one-line change here,
// the same pattern the architecture baseline already uses for ITrackingStore.
export const cacheProvider: ICacheProvider = new InMemoryCacheProvider();

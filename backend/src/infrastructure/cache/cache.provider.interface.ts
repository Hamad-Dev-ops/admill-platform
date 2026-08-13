// Async even though the V1 in-memory implementation doesn't need to await anything —
// a future RedisCacheProvider genuinely does network I/O, and the interface has to
// accommodate that from day one so swapping implementations needs zero call-site changes.
export interface ICacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

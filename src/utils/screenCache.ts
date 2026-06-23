type ScreenCacheEntry<T> = {
  value: T;
  updatedAt: number;
};

const screenCache = new Map<string, ScreenCacheEntry<unknown>>();

export function readScreenCache<T>(key: string): ScreenCacheEntry<T> | null {
  const entry = screenCache.get(key);
  return entry ? (entry as ScreenCacheEntry<T>) : null;
}

export function writeScreenCache<T>(key: string, value: T, updatedAt = Date.now()) {
  screenCache.set(key, { value, updatedAt });
}

export function clearScreenCache(key: string) {
  screenCache.delete(key);
}

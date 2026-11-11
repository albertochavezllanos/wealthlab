import "server-only";

/**
 * Small in-memory cache with time-to-live and in-flight de-duplication.
 * Works per server instance; Vercel's CDN cache (Cache-Control headers on
 * our API responses) provides the shared layer on top.
 */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 400;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await load();
      if (store.size >= MAX_ENTRIES) {
        // Drop the oldest entry (Map keeps insertion order)
        const first = store.keys().next().value;
        if (first !== undefined) store.delete(first);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Remove a cached value (e.g. a result produced with incomplete data). */
export function forget(key: string) {
  store.delete(key);
}

/** Peek at a cached value even if expired (used as a fallback when the provider is rate-limited). */
export function stale<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}

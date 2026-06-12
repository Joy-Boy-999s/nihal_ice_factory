/**
 * Tiny stale-while-revalidate cache on sessionStorage.
 *
 * Pages render the last-known data instantly and refresh in the background —
 * so a slow API (Render cold start, cross-region DB) never leaves the user
 * staring at a spinner on a page they've already visited this session.
 *
 * Keys must include the user id so switching accounts in the same tab never
 * shows someone else's data.
 */

interface CacheEnvelope<T> {
  ts: number;
  data: T;
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* storage full / disabled — caching is best-effort */
  }
}

/**
 * Timestamped localStorage cache. Used so time-sensitive data (weather,
 * fire-ban) survives going offline in the forest — always paired in the UI
 * with a visible "checked at" so a stale value is never mistaken for live.
 */

export interface Cached<T> {
  value: T;
  cachedAt: string; // ISO timestamp
}

const PREFIX = "fch:";

export function loadCache<T>(key: string): Cached<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as Cached<T>;
  } catch {
    return null;
  }
}

export function saveCache<T>(key: string, value: T): Cached<T> {
  const entry: Cached<T> = { value, cachedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }
  return entry;
}

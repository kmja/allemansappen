"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True only after client hydration. Lets us defer client-only UI (e.g. opening
 * the first-run dialog) without causing an SSR/hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * useState mirrored to localStorage, implemented with useSyncExternalStore so
 * there is no setState-in-effect and SSR/hydration stays consistent. Writes
 * dispatch a same-tab `storage` event so every reader of the key updates.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key || e.key === null) onChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const value = useMemo<T>(() => {
    if (raw == null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  }, [raw, initial]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      let current: T;
      try {
        const existing = window.localStorage.getItem(key);
        current = existing != null ? (JSON.parse(existing) as T) : initial;
      } catch {
        current = initial;
      }
      const next =
        typeof updater === "function"
          ? (updater as (prev: T) => T)(current)
          : updater;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable — non-fatal */
      }
      // Native storage events don't fire in the same tab; notify ourselves.
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key, initial],
  );

  return [value, setValue] as const;
}

/** Tracks online/offline so the UI can flag stale cached data. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

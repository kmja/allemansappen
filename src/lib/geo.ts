import type { BBox } from "./types";

/** Round a coordinate to a sensible precision (≈1 m) for cache keys / APIs. */
export function roundCoord(n: number, decimals = 5): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Format a bbox as the `south,west,north,east` string Overpass expects. */
export function bboxToOverpass(bbox: BBox): string {
  const [west, south, east, north] = bbox;
  return `${roundCoord(south)},${roundCoord(west)},${roundCoord(north)},${roundCoord(east)}`;
}

/** Parse a `west,south,east,north` query string into a validated BBox. */
export function parseBBox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  return [west, south, east, north];
}

/** Approximate ground area of a bbox in square kilometres (sanity guard). */
export function bboxAreaKm2(bbox: BBox): number {
  const [west, south, east, north] = bbox;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(midLat);
  return Math.abs(north - south) * kmPerDegLat * Math.abs(east - west) * kmPerDegLng;
}

/** Format an ISO timestamp as a short Swedish "checked at" string. */
export function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** How long ago, in plain Swedish, e.g. "3 min sedan". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return "nyss";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h sedan`;
  const days = Math.round(hours / 24);
  return `${days} d sedan`;
}

import type { Feature, FeatureCollection } from "geojson";

/** A bounding box as [west, south, east, north] (lng/lat, EPSG:4326). */
export type BBox = [west: number, south: number, east: number, north: number];

export interface LngLat {
  lng: number;
  lat: number;
}

/** Toggleable overlay layers shown on the map. */
export type OverlayId =
  | "property"
  | "buildings"
  | "hemfridszon"
  | "landuse"
  | "reserves";

/** The kinds of OpenStreetMap data we fetch from Overpass. */
export type OverpassKind = "buildings" | "landuse" | "reserves";

/** Lifecycle status for any async data layer/banner. */
export type DataStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "unavailable"
  | "zoom"; // zoomed too far out to query

export interface OverpassResponse extends FeatureCollection {
  /** Echo of what was requested, for cache/debug. */
  meta: {
    kind: OverpassKind;
    bbox: BBox;
    count: number;
    fetchedAt: string;
  };
}

export type { Feature, FeatureCollection };

/**
 * Fire-ban result. We deliberately do NOT assert "no ban" — the honest
 * default is `unknown`, pointing the user at the authoritative source.
 * The shape allows a real feed to populate `ban`/`no-ban` later.
 */
export type FireBanStatus = "unknown" | "ban" | "no-ban" | "error";

export interface FireBanLink {
  label: string;
  href: string;
}

export interface FireBanResult {
  status: FireBanStatus;
  /** Plain-Swedish, honest framing for the banner. */
  headline: string;
  detail: string;
  county?: string;
  links: FireBanLink[];
  checkedAt: string; // ISO timestamp
  source: string;
}

export interface WeatherResult {
  temperatureC: number | null;
  windMs: number | null;
  windGustMs: number | null;
  precipMm: number | null;
  /** SMHI Wsymb2 code (1–27), or null. */
  symbol: number | null;
  description: string;
  checkedAt: string; // ISO timestamp
  source: string;
  sourceUrl: string;
}

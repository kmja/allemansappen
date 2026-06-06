import type { Feature } from "geojson";
import type {
  DataStatus,
  LngLat,
  RuleAssessment,
  RuleId,
  RuleVerdict,
} from "./types";

/**
 * Position assessment: for the user's GPS point, classify each allemansrätten
 * consideration as in-the-green / avoid / your-judgment — honestly. A "clear"
 * verdict only ever means "the loaded data shows no obstacle here", never "it is
 * legal to camp". Anything the app cannot determine (hemfridszon distance, fire
 * ban) is surfaced as `judgment`, and anything not yet loaded as
 * `checking`/`unknown` rather than a false green.
 *
 * Geometry is hand-rolled (no turf point-in-polygon/distance dependency) so it
 * stays pure and unit-testable. Holes are ignored, matching the overlay's
 * documented outer-ring-only simplification.
 */

// ---------------------------------------------------------------------------
// Geometry (pure, dependency-free)
// ---------------------------------------------------------------------------

/** Outer rings ([lng,lat][]) of a Polygon / MultiPolygon feature. */
export function outerRings(feature: Feature): number[][][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === "Polygon") {
    return g.coordinates.length ? [g.coordinates[0] as number[][]] : [];
  }
  if (g.type === "MultiPolygon") {
    return g.coordinates
      .map((poly) => (poly.length ? (poly[0] as number[][]) : null))
      .filter((r): r is number[][] => r != null);
  }
  return [];
}

/** Ray-casting point-in-ring test. `ring` is [lng,lat][]. */
export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInFeature(p: LngLat, feature: Feature): boolean {
  for (const ring of outerRings(feature)) {
    if (pointInRing(p.lng, p.lat, ring)) return true;
  }
  return false;
}

/** First feature whose outer ring contains the point, or null. */
export function featureAt(p: LngLat, features: Feature[]): Feature | null {
  for (const f of features) if (pointInFeature(p, f)) return f;
  return null;
}

const EARTH_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance (m) from p to segment a–b on a local equirectangular plane. */
function pointToSegmentMeters(p: LngLat, a: number[], b: number[]): number {
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(toRad(p.lat));
  const ax = (a[0] - p.lng) * mPerLng;
  const ay = (a[1] - p.lat) * mPerLat;
  const bx = (b[0] - p.lng) * mPerLng;
  const by = (b[1] - p.lat) * mPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : (-ax * dx + -ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/** Min distance (m) from p to any feature's boundary; 0 if inside one. */
export function distanceToFeaturesMeters(p: LngLat, features: Feature[]): number {
  let min = Infinity;
  for (const f of features) {
    if (pointInFeature(p, f)) return 0;
    for (const ring of outerRings(f)) {
      for (let i = 1; i < ring.length; i++) {
        const d = pointToSegmentMeters(p, ring[i - 1], ring[i]);
        if (d < min) min = d;
      }
    }
  }
  return min;
}

// ---------------------------------------------------------------------------
// Rule assessment
// ---------------------------------------------------------------------------

export interface OverlayInput {
  status: DataStatus;
  features: Feature[];
  /**
   * Whether the assessed point lies within this layer's *loaded* data extent.
   * Guards against showing a verdict computed from data fetched for a different
   * area (e.g. just after panning, before the refetch lands).
   */
  covers: boolean;
}

export interface AssessInputs {
  reserves: OverlayInput;
  cultivated: OverlayInput;
  buildings: OverlayInput;
  /** Is the GPS point inside the currently-loaded map view? */
  positionInView: boolean;
  /** Within this distance from a building: no-camp (avoid). */
  buildingNoCampM: number;
  /** Up to this distance from a building: caution band (judgment). */
  buildingCautionM: number;
}

function mk(
  id: RuleId,
  label: string,
  verdict: RuleVerdict,
  headline: string,
  detail: string,
): RuleAssessment {
  return { id, label, verdict, headline, detail };
}

/**
 * If a data layer can't be used yet (off-screen / loading / zoomed out / off /
 * errored), return the honest non-verdict to show; otherwise null (data ready).
 */
function gate(
  input: OverlayInput,
  positionInView: boolean,
): Pick<RuleAssessment, "verdict" | "headline" | "detail"> | null {
  if (!positionInView) {
    return {
      verdict: "unknown",
      headline: "Utanför kartvyn",
      detail: "Centrera kartan på din plats för att bedöma här.",
    };
  }
  switch (input.status) {
    case "loading":
      return {
        verdict: "checking",
        headline: "Kontrollerar…",
        detail: "Hämtar underlag för din plats.",
      };
    case "zoom":
      return {
        verdict: "unknown",
        headline: "Zooma in",
        detail: "Kartan är för utzoomad för att ladda underlaget.",
      };
    case "error":
      return {
        verdict: "unknown",
        headline: "Kunde inte hämta",
        detail: "Underlaget gick inte att hämta (offline?).",
      };
    case "idle":
    case "unavailable":
      return {
        verdict: "unknown",
        headline: "Lagret är av",
        detail: "Slå på lagret för att bedöma här.",
      };
    default:
      // ready / empty: only trust it if the loaded data actually covers the
      // point. Otherwise it is stale (a refetch is pending) -> "checking",
      // never a verdict attributed to the wrong area.
      if (!input.covers) {
        return {
          verdict: "checking",
          headline: "Kontrollerar…",
          detail: "Hämtar underlag för platsen.",
        };
      }
      return null;
  }
}

function reserveName(f: Feature): string {
  const n = (f.properties as Record<string, unknown> | null)?.name;
  return typeof n === "string" && n ? n : "ett naturreservat";
}

const round5 = (m: number) => Math.round(m / 5) * 5;

export function assessReserve(
  p: LngLat,
  input: OverlayInput,
  positionInView: boolean,
): RuleAssessment {
  const g = gate(input, positionInView);
  if (g) return mk("reserve", "Naturreservat", g.verdict, g.headline, g.detail);
  const f = featureAt(p, input.features);
  if (f) {
    return mk(
      "reserve",
      "Naturreservat",
      "avoid",
      "I ett naturreservat",
      `Du är i ${reserveName(f)}. Reservat har egna regler – tältning kan vara begränsad eller förbjuden. Läs beslut/skyltar på plats.`,
    );
  }
  return mk(
    "reserve",
    "Naturreservat",
    "clear",
    "Inget reservat här",
    "Du verkar inte vara i ett naturreservat (enligt OpenStreetMap-data).",
  );
}

export function assessCultivated(
  p: LngLat,
  input: OverlayInput,
  positionInView: boolean,
): RuleAssessment {
  const g = gate(input, positionInView);
  if (g) return mk("cultivated", "Brukad mark", g.verdict, g.headline, g.detail);
  if (featureAt(p, input.features)) {
    return mk(
      "cultivated",
      "Brukad mark",
      "avoid",
      "På brukad mark",
      "Du står på åker, äng eller plantering – tälta inte här, det kan skada grödor.",
    );
  }
  return mk(
    "cultivated",
    "Brukad mark",
    "clear",
    "Inte brukad mark",
    "Ingen åker eller äng här (enligt OpenStreetMap-data).",
  );
}

export function assessHemfridszon(
  p: LngLat,
  input: OverlayInput,
  positionInView: boolean,
  noCampM: number,
  cautionM: number,
): RuleAssessment {
  const g = gate(input, positionInView);
  if (g) return mk("hemfridszon", "Hemfridszon", g.verdict, g.headline, g.detail);
  const d = distanceToFeaturesMeters(p, input.features);
  if (!Number.isFinite(d)) {
    return mk(
      "hemfridszon",
      "Hemfridszon",
      "clear",
      "Inga byggnader nära",
      "Inga byggnader hittades i närheten (enligt OSM). Tänk ändå på insyn mot bostäder.",
    );
  }
  if (d < noCampM) {
    return mk(
      "hemfridszon",
      "Hemfridszon",
      "avoid",
      d === 0 ? "Vid en byggnad" : `Inom ${noCampM} m från byggnad`,
      `Så nära en bostad ska du inte tälta – det räknas som hemfridszon. Håll minst ${noCampM} m och undvik insyn.`,
    );
  }
  const m = round5(d);
  if (d < cautionM) {
    return mk(
      "hemfridszon",
      "Hemfridszon",
      "judgment",
      `~${m} m till byggnad`,
      `${noCampM}–${cautionM} m från en byggnad – kan fortfarande vara för nära. Din bedömning; undvik insyn mot bostäder.`,
    );
  }
  return mk(
    "hemfridszon",
    "Hemfridszon",
    "clear",
    `~${m} m till byggnad`,
    "Gott avstånd till närmaste byggnad. Tänk ändå på sikt mot bostäder.",
  );
}

export function assessFire(): RuleAssessment {
  return mk(
    "fire",
    "Eldningsförbud",
    "judgment",
    "Kontrollera lokalt",
    "Appen kan inte bekräfta om det råder eldningsförbud här. Kontrollera hos din länsstyrelse innan du eldar.",
  );
}

export function assessPosition(
  p: LngLat,
  inputs: AssessInputs,
): RuleAssessment[] {
  return [
    assessReserve(p, inputs.reserves, inputs.positionInView),
    assessCultivated(p, inputs.cultivated, inputs.positionInView),
    assessHemfridszon(
      p,
      inputs.buildings,
      inputs.positionInView,
      inputs.buildingNoCampM,
      inputs.buildingCautionM,
    ),
    assessFire(),
  ];
}

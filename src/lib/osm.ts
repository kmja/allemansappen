import type { Feature, Geometry, MultiPolygon, Point, Polygon } from "geojson";
import type { BBox, OverpassKind } from "./types";
import { bboxToOverpass } from "./geo";

/**
 * Pure OpenStreetMap / Overpass helpers: query building and `out geom` ->
 * GeoJSON conversion. Kept free of any server-only / network code so it can be
 * unit-tested directly.
 */

const LANDUSE_VALUES = [
  "farmland",
  "meadow",
  "orchard",
  "vineyard",
  "allotments",
  "farmyard",
  "plant_nursery",
  "greenhouse_horticulture",
].join("|");

/** Per-kind cap on Overpass elements returned (`out geom`/`out center`). */
export const OUT_LIMITS: Record<OverpassKind, number> = {
  buildings: 3000,
  landuse: 2000,
  reserves: 800,
  amenities: 700,
};

export function buildOverpassQuery(kind: OverpassKind, bbox: BBox): string {
  const bb = bboxToOverpass(bbox);
  switch (kind) {
    case "buildings":
      return `[out:json][timeout:25];(way["building"](${bb});relation["building"](${bb}););out geom ${OUT_LIMITS.buildings};`;
    case "landuse":
      return `[out:json][timeout:25];(way["landuse"~"^(${LANDUSE_VALUES})$"](${bb});relation["landuse"~"^(${LANDUSE_VALUES})$"](${bb}););out geom ${OUT_LIMITS.landuse};`;
    case "reserves":
      return `[out:json][timeout:25];(way["leisure"="nature_reserve"](${bb});relation["leisure"="nature_reserve"](${bb});way["boundary"="protected_area"](${bb});relation["boundary"="protected_area"](${bb}););out geom ${OUT_LIMITS.reserves};`;
    case "amenities":
      return `[out:json][timeout:25];(nwr["amenity"~"^(toilets|shelter|drinking_water|bbq)$"](${bb});nwr["leisure"~"^(firepit|fireplace|picnic_table)$"](${bb});nwr["tourism"~"^(wilderness_hut|alpine_hut|camp_site|picnic_site)$"](${bb}););out center ${OUT_LIMITS.amenities};`;
    default:
      throw new Error(`Unknown overpass kind: ${kind satisfies never}`);
  }
}

/** Normalised amenity category for a POI's tags (for colouring / labelling). */
export function amenityCategory(tags: Record<string, string>): string {
  const { amenity, leisure, tourism } = tags;
  if (amenity === "toilets") return "toilet";
  if (amenity === "drinking_water") return "water";
  if (
    amenity === "shelter" ||
    tourism === "wilderness_hut" ||
    tourism === "alpine_hut"
  ) {
    return "shelter";
  }
  if (leisure === "firepit" || leisure === "fireplace" || amenity === "bbq") {
    return "fire";
  }
  if (leisure === "picnic_table" || tourism === "picnic_site") return "picnic";
  if (tourism === "camp_site") return "campsite";
  return "other";
}

// ---------------------------------------------------------------------------
// OSM (Overpass `out geom`) -> GeoJSON
//
// Deliberately small and predictable rather than pulling a conversion library
// we cannot live-test in this environment. Ways become Polygons (rings are
// closed if open); multipolygon/boundary relations become MultiPolygons of
// their outer members. Inner rings (holes, e.g. lakes cut out of a reserve)
// are not subtracted — acceptable for a visual overlay; documented limitation.
// ---------------------------------------------------------------------------

interface OsmGeomPoint {
  lat: number;
  lon: number;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  /** Center point for way/relation results from `out center` (amenity POIs). */
  center?: { lat: number; lon: number };
  geometry?: OsmGeomPoint[];
  members?: {
    type: string;
    role: string;
    geometry?: OsmGeomPoint[];
  }[];
}

function closedRing(geom: OsmGeomPoint[]): number[][] {
  const coords = geom.map((p) => [p.lon, p.lat] as [number, number]);
  if (coords.length === 0) return coords;
  const [fx, fy] = coords[0];
  const [lx, ly] = coords[coords.length - 1];
  if (fx !== lx || fy !== ly) coords.push([fx, fy]);
  return coords;
}

function featureFromElement(el: OsmElement): Feature | null {
  const properties: Record<string, unknown> = {
    osm_id: `${el.type}/${el.id}`,
    ...(el.tags ?? {}),
  };

  if (el.type === "node" && el.lat != null && el.lon != null) {
    const geometry: Point = { type: "Point", coordinates: [el.lon, el.lat] };
    return { type: "Feature", geometry, properties };
  }

  // Amenity POIs arrive via `out center`: a way/relation carrying a `center`.
  if (el.center) {
    const geometry: Point = {
      type: "Point",
      coordinates: [el.center.lon, el.center.lat],
    };
    return { type: "Feature", geometry, properties };
  }

  if (el.type === "way" && el.geometry && el.geometry.length >= 3) {
    const ring = closedRing(el.geometry);
    if (ring.length < 4) return null;
    const geometry: Polygon = { type: "Polygon", coordinates: [ring] };
    return { type: "Feature", geometry, properties };
  }

  if (el.type === "relation" && el.members) {
    const outers = el.members
      .filter((m) => m.geometry && m.geometry.length >= 3 && m.role !== "inner")
      .map((m) => [closedRing(m.geometry!)])
      .filter((poly) => poly[0].length >= 4);
    if (outers.length === 0) return null;
    const geometry: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: outers,
    };
    return { type: "Feature", geometry, properties };
  }

  return null;
}

export function osmToGeoJSON(elements: OsmElement[]): Feature<Geometry>[] {
  const features: Feature[] = [];
  for (const el of elements) {
    const f = featureFromElement(el);
    if (f) features.push(f);
  }
  return features;
}

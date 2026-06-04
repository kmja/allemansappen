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

export function buildOverpassQuery(kind: OverpassKind, bbox: BBox): string {
  const bb = bboxToOverpass(bbox);
  switch (kind) {
    case "buildings":
      return `[out:json][timeout:25];(way["building"](${bb});relation["building"](${bb}););out geom 3000;`;
    case "landuse":
      return `[out:json][timeout:25];(way["landuse"~"^(${LANDUSE_VALUES})$"](${bb});relation["landuse"~"^(${LANDUSE_VALUES})$"](${bb}););out geom 2000;`;
    case "reserves":
      return `[out:json][timeout:25];(way["leisure"="nature_reserve"](${bb});relation["leisure"="nature_reserve"](${bb});way["boundary"="protected_area"](${bb});relation["boundary"="protected_area"](${bb}););out geom 800;`;
    default:
      throw new Error(`Unknown overpass kind: ${kind satisfies never}`);
  }
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

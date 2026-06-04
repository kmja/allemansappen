import "server-only";

import type { BBox, OverpassKind, OverpassResponse } from "../types";
import { buildOverpassQuery, osmToGeoJSON, type OsmElement } from "../osm";

const OVERPASS_URL =
  process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

const USER_AGENT =
  "FriluftslivCampingHelper/0.1 (allemansrätten map; +https://github.com/kmja/allemansappen)";

export async function fetchOverpass(
  kind: OverpassKind,
  bbox: BBox,
): Promise<OverpassResponse> {
  const query = buildOverpassQuery(kind, bbox);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30_000),
    // Cache identical bbox/kind requests briefly on the server.
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Overpass svarade ${res.status}`);
  }

  const json = (await res.json()) as { elements?: OsmElement[] };
  const features = osmToGeoJSON(json.elements ?? []);

  return {
    type: "FeatureCollection",
    features,
    meta: {
      kind,
      bbox,
      count: features.length,
      fetchedAt: new Date().toISOString(),
    },
  };
}

import type { StyleSpecification } from "maplibre-gl";
import { BASEMAP_STYLE_URL } from "../config";

/**
 * Zero-config default basemap: OpenStreetMap raster tiles. No API key needed.
 * For production you should switch to a provider that permits your volume
 * (e.g. Lantmäteriet topo or a vector style) via NEXT_PUBLIC_BASEMAP_STYLE_URL.
 */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-bidragsgivare',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

/** Resolve the basemap: a custom style URL if configured, else OSM raster. */
export function getBasemap(): string | StyleSpecification {
  return BASEMAP_STYLE_URL ?? OSM_RASTER_STYLE;
}

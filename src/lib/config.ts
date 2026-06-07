/**
 * Client-safe configuration. Only values that are safe to ship to the browser
 * live here (i.e. NEXT_PUBLIC_* and constants). Server-only secrets such as
 * Lantmäteriet credentials are read directly inside the relevant route
 * handlers and never imported into client code.
 */

/** Optional custom MapLibre basemap style URL (vector or raster). */
export const BASEMAP_STYLE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL?.trim() || null;

/**
 * Whether to surface the property-boundary (Lantmäteriet) toggle. Off by
 * default because it needs configured server-side credentials; flip the
 * NEXT_PUBLIC_PROPERTY_LAYER_ENABLED env to "true" once /api/lm-tiles works.
 */
export const PROPERTY_LAYER_ENABLED =
  process.env.NEXT_PUBLIC_PROPERTY_LAYER_ENABLED === "true";

/** Default map view: roughly the geographic centre of Sweden. */
export const DEFAULT_CENTER: [number, number] = [15.5, 62.5];
export const DEFAULT_ZOOM = 4.2;

/** When a located user is centred, zoom in to this level. */
export const LOCATED_ZOOM = 15;

/**
 * Minimum zoom at which we query Overpass. Below this the bbox covers too much
 * ground and the query would be huge / slow, so overlays pause and prompt the
 * user to zoom in.
 */
export const OVERPASS_MIN_ZOOM = 13;

/**
 * Half-size (km) of the area quietly prefetched around a dropped pin so nearby
 * spots rule instantly without another fetch. Kept well under the
 * /api/overpass area cap (≈100 km² here).
 */
export const PREFETCH_HALF_KM = 5;

/**
 * Building-distance zones (metres). Within NOCAMP you should not camp (shown in
 * red); NOCAMP–CAUTION is a softer "likely too close" band (amber). Hemfridszon
 * is legally fuzzy, so these are guidance — not an exact legal line (see UI).
 */
export const BUILDING_NOCAMP_M = 60;
export const BUILDING_CAUTION_M = 100;

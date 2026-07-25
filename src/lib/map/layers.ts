import type { OverlayId, OverpassKind } from "../types";

/** Building-distance zone fills (thresholds live in config). */
export const NOCAMP_COLOR = "#dc2626"; // red — within 60 m: don't camp
export const CAUTION_COLOR = "#f59e0b"; // amber — 60–100 m: likely too close

/** Legend / render colours per overlay. */
export const OVERLAY_COLORS: Record<OverlayId, string> = {
  property: "#4338ca", // indigo
  buildings: "#9a3412", // burnt orange
  hemfridszon: NOCAMP_COLOR, // red (no-camp zone)
  landuse: "#ca8a04", // ochre (caution)
  reserves: "#15803d", // forest green
  amenities: "#0d9488", // teal
};

/** Per-category styling for amenity POIs (map colour + popup emoji/label). */
export const AMENITY_META: Record<
  string,
  { color: string; emoji: string; label: string }
> = {
  toilet: { color: "#2563eb", emoji: "🚻", label: "Toalett" },
  water: { color: "#0891b2", emoji: "🚰", label: "Dricksvatten" },
  shelter: { color: "#16a34a", emoji: "⛺", label: "Vindskydd / stuga" },
  fire: { color: "#ea580c", emoji: "🔥", label: "Eldplats / grill" },
  picnic: { color: "#a16207", emoji: "🪑", label: "Rastplats" },
  campsite: { color: "#7c3aed", emoji: "🏕️", label: "Tältplats" },
  other: { color: "#6b7280", emoji: "📍", label: "Plats" },
};

export interface OverlayConfig {
  id: OverlayId;
  label: string;
  description: string;
  defaultEnabled: boolean;
  source: "overpass" | "lantmateriet" | "derived";
  overpassKind?: OverpassKind;
  /** Whether this overlay needs a minimum zoom (Overpass-backed ones do). */
  needsZoom: boolean;
  color: string;
}

/**
 * The overlay registry. Order here is the order shown in the toggle panel.
 * Property boundaries come last because they require configured Lantmäteriet
 * access; the rest are zero-config (OpenStreetMap via Overpass / derived).
 */
export const OVERLAYS: OverlayConfig[] = [
  {
    id: "buildings",
    label: "Byggnader",
    description:
      "Hjälper dig hålla avstånd till bostäder. Hemfridszonen utgår från hus.",
    defaultEnabled: true,
    source: "overpass",
    overpassKind: "buildings",
    needsZoom: true,
    color: OVERLAY_COLORS.buildings,
  },
  {
    id: "hemfridszon",
    label: "Avstånd till byggnader",
    description:
      "Rött: inom 60 m – tälta inte (hemfridszon). Gult: 60–100 m – troligen för nära. Vägledande, inte en exakt gräns.",
    defaultEnabled: true,
    source: "derived",
    needsZoom: true,
    color: OVERLAY_COLORS.hemfridszon,
  },
  {
    id: "landuse",
    label: "Brukad mark",
    description: "Åker, äng och planteringar – undvik att tälta här.",
    defaultEnabled: true,
    source: "overpass",
    overpassKind: "landuse",
    needsZoom: true,
    color: OVERLAY_COLORS.landuse,
  },
  {
    id: "reserves",
    label: "Naturreservat",
    description: "Skyddade områden med egna regler. Tryck för officiell sida.",
    defaultEnabled: true,
    source: "overpass",
    overpassKind: "reserves",
    needsZoom: true,
    color: OVERLAY_COLORS.reserves,
  },
  {
    id: "amenities",
    label: "Bekvämligheter",
    description:
      "Toaletter, vindskydd, eldplatser, dricksvatten och rastplatser (färgade prickar). Tryck på en prick för info.",
    defaultEnabled: true,
    source: "overpass",
    overpassKind: "amenities",
    needsZoom: true,
    color: OVERLAY_COLORS.amenities,
  },
  {
    id: "property",
    label: "Fastighetsgränser",
    description: "Lantmäteriets gränser. Kräver konfigurerad åtkomst.",
    defaultEnabled: false,
    source: "lantmateriet",
    needsZoom: false,
    color: OVERLAY_COLORS.property,
  },
];

export function overlayById(id: OverlayId): OverlayConfig | undefined {
  return OVERLAYS.find((o) => o.id === id);
}

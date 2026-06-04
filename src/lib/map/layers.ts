import type { OverlayId, OverpassKind } from "../types";

/** Legend / render colours per overlay. */
export const OVERLAY_COLORS: Record<OverlayId, string> = {
  property: "#4338ca", // indigo
  buildings: "#9a3412", // burnt orange
  hemfridszon: "#f59e0b", // amber (indicative)
  landuse: "#ca8a04", // ochre (caution)
  reserves: "#15803d", // forest green
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
    label: "Hemfridszon (indikativ)",
    description:
      "Mjuk ~65 m-zon runt byggnader. Endast vägledande – inte en juridisk gräns.",
    defaultEnabled: false,
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

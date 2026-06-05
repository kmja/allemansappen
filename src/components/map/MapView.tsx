"use client";

import { useEffect, useRef } from "react";
import {
  Map as MlMap,
  Marker,
  NavigationControl,
  ScaleControl,
  GeolocateControl,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import { buffer } from "@turf/buffer";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import { getBasemap } from "@/lib/map/basemap";
import { OVERLAY_COLORS } from "@/lib/map/layers";
import { getJson } from "@/lib/data/client";
import { safeHttpUrl } from "@/lib/url";
import { assessPosition } from "@/lib/assess";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  HEMFRIDSZON_RADIUS_M,
  OVERPASS_MIN_ZOOM,
} from "@/lib/config";
import type {
  BBox,
  DataStatus,
  LngLat,
  OverlayId,
  OverpassKind,
  OverpassResponse,
  PositionAssessment,
} from "@/lib/types";

export interface ViewState {
  center: LngLat;
  zoom: number;
  bbox: BBox;
}

interface MapViewProps {
  enabled: Record<OverlayId, boolean>;
  propertyConfigured: boolean;
  onViewChange?: (view: ViewState) => void;
  onLocate?: (coords: LngLat) => void;
  onStatusChange?: (statuses: Record<OverpassKind, DataStatus>) => void;
  /** Receives a function the parent can call to trigger GPS centring. */
  registerLocate?: (trigger: () => void) => void;
  onLocateError?: (message: string) => void;
  onAssessment?: (assessment: PositionAssessment) => void;
}

const ALL_KINDS: OverpassKind[] = ["buildings", "landuse", "reserves"];
const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Minimal shape shared by MapLibre's mouse/touch events for press detection. */
type PressEvent = {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
  points?: unknown[];
};

function geolocationErrorMessage(code?: number): string {
  switch (code) {
    case 1:
      return "Platsåtkomst nekades – tillåt platsdelning för att centrera kartan.";
    case 2:
      return "Din position kunde inte hämtas just nu.";
    case 3:
      return "Det tog för lång tid att hämta din position.";
    default:
      return "Kunde inte hämta din position.";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function MapView({
  enabled,
  propertyConfigured,
  onViewChange,
  onLocate,
  onStatusChange,
  registerLocate,
  onLocateError,
  onAssessment,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);

  // Latest props, read inside stable map event handlers without re-subscribing.
  const propsRef = useRef({
    enabled,
    propertyConfigured,
    onViewChange,
    onLocate,
    onStatusChange,
    registerLocate,
    onLocateError,
    onAssessment,
  });
  useEffect(() => {
    propsRef.current = {
      enabled,
      propertyConfigured,
      onViewChange,
      onLocate,
      onStatusChange,
      registerLocate,
      onLocateError,
      onAssessment,
    };
  });

  const dataRef = useRef<Record<OverpassKind, OverpassResponse | null>>({
    buildings: null,
    landuse: null,
    reserves: null,
  });
  const abortRef = useRef<Record<OverpassKind, AbortController | null>>({
    buildings: null,
    landuse: null,
    reserves: null,
  });
  const statusRef = useRef<Record<OverpassKind, DataStatus>>({
    buildings: "idle",
    landuse: "idle",
    reserves: "idle",
  });
  const debounceRef = useRef<number | undefined>(undefined);
  const locatedRef = useRef<LngLat | null>(null);
  const pickedRef = useRef<LngLat | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pressTimerRef = useRef<number | undefined>(undefined);

  // Imperative hooks so prop-driven effects can call into the map closure.
  const applyRef = useRef<() => void>(() => {});
  const refreshRef = useRef<() => void>(() => {});

  // ---- init map once -------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Captured for the cleanup closure (the ref object identity is stable).
    const abortControllers = abortRef.current;

    const map = new MlMap({
      container: containerRef.current,
      style: getBasemap(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 19,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Re-evaluate the per-rule assessment at the user's GPS point. Emits an
    // honest "off-screen / loading" state when the point isn't covered by the
    // currently-loaded data, so a stale green is never shown.
    const emitAssessment = () => {
      const cb = propsRef.current.onAssessment;
      if (!cb) return;
      const picked = pickedRef.current;
      const point = picked ?? locatedRef.current;
      const origin = picked ? "picked" : "gps";
      if (!point) {
        cb({ located: false, origin: "gps", positionInView: false, rules: [] });
        return;
      }
      const b = map.getBounds();
      const positionInView =
        point.lng >= b.getWest() &&
        point.lng <= b.getEast() &&
        point.lat >= b.getSouth() &&
        point.lat <= b.getNorth();
      const layer = (kind: OverpassKind) => ({
        status: statusRef.current[kind],
        features: dataRef.current[kind]?.features ?? [],
      });
      cb({
        located: true,
        origin,
        positionInView,
        rules: assessPosition(point, {
          reserves: layer("reserves"),
          cultivated: layer("landuse"),
          buildings: layer("buildings"),
          positionInView,
          hemfridszonRadiusM: HEMFRIDSZON_RADIUS_M,
        }),
      });
    };

    map.addControl(new NavigationControl({ showCompass: true }), "top-left");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      // One-shot, not continuous: a picked point must survive, and the map
      // shouldn't snap back to GPS every few seconds. The locate button (and
      // "Använd min plats") re-triggers a fresh fix on demand.
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, "top-left");
    geolocate.on("geolocate", (e) => {
      const pos = e as GeolocationPosition;
      const coords = {
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
      };
      locatedRef.current = coords;
      // A real GPS fix supersedes any tapped point.
      pickedRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      propsRef.current.onLocate?.(coords);
      emitAssessment();
    });
    geolocate.on("error", (e) => {
      const err = e as Partial<GeolocationPositionError>;
      propsRef.current.onLocateError?.(geolocationErrorMessage(err?.code));
    });
    propsRef.current.registerLocate?.(() => {
      try {
        geolocate.trigger();
      } catch {
        propsRef.current.onLocateError?.(geolocationErrorMessage());
      }
    });

    const setStatus = (kind: OverpassKind, status: DataStatus) => {
      statusRef.current[kind] = status;
      propsRef.current.onStatusChange?.({ ...statusRef.current });
      emitAssessment();
    };

    const getBBox = (): BBox => {
      const b = map.getBounds();
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    };

    const emitView = () => {
      const c = map.getCenter();
      propsRef.current.onViewChange?.({
        center: { lng: c.lng, lat: c.lat },
        zoom: map.getZoom(),
        bbox: getBBox(),
      });
    };

    const setSourceData = (kind: OverpassKind, fc: FeatureCollection) => {
      const src = map.getSource(`src-${kind}`) as GeoJSONSource | undefined;
      src?.setData(fc);
    };

    const updateHemfridszon = () => {
      const src = map.getSource("src-hemfridszon") as GeoJSONSource | undefined;
      if (!src) return;
      const buildings = dataRef.current.buildings;
      if (!propsRef.current.enabled.hemfridszon || !buildings?.features.length) {
        src.setData(EMPTY_FC);
        return;
      }
      try {
        const capped: FeatureCollection = {
          type: "FeatureCollection",
          features: buildings.features.slice(0, 500),
        };
        const buffered = buffer(capped, HEMFRIDSZON_RADIUS_M, {
          units: "meters",
        });
        src.setData(buffered ?? EMPTY_FC);
      } catch {
        src.setData(EMPTY_FC);
      }
    };

    const neededKinds = (): OverpassKind[] => {
      const e = propsRef.current.enabled;
      const kinds: OverpassKind[] = [];
      if (e.buildings || e.hemfridszon) kinds.push("buildings");
      if (e.landuse) kinds.push("landuse");
      if (e.reserves) kinds.push("reserves");
      return kinds;
    };

    const fetchKind = async (kind: OverpassKind, bbox: BBox) => {
      abortRef.current[kind]?.abort();
      const ac = new AbortController();
      abortRef.current[kind] = ac;
      setStatus(kind, "loading");
      try {
        const data = await getJson<OverpassResponse>(
          `/api/overpass?kind=${kind}&bbox=${bbox.join(",")}`,
          ac.signal,
        );
        dataRef.current[kind] = data;
        setSourceData(kind, data);
        setStatus(kind, data.features.length ? "ready" : "empty");
        if (kind === "buildings") updateHemfridszon();
      } catch {
        if (ac.signal.aborted) return;
        setStatus(kind, "error");
      }
    };

    const refreshOverlays = () => {
      const kinds = neededKinds();
      const zoom = map.getZoom();
      const bbox = getBBox();
      for (const kind of ALL_KINDS) {
        if (!kinds.includes(kind)) {
          setStatus(kind, "idle");
          continue;
        }
        if (zoom < OVERPASS_MIN_ZOOM) {
          setStatus(kind, "zoom");
          setSourceData(kind, EMPTY_FC);
          dataRef.current[kind] = null;
          continue;
        }
        void fetchKind(kind, bbox);
      }
      updateHemfridszon();
    };
    refreshRef.current = refreshOverlays;

    const applyVisibility = () => {
      const e = propsRef.current.enabled;
      const vis = (id: string, on: boolean) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
        }
      };
      vis("buildings-fill", e.buildings);
      vis("buildings-line", e.buildings);
      vis("hemfridszon-fill", e.hemfridszon);
      vis("hemfridszon-line", e.hemfridszon);
      vis("landuse-fill", e.landuse);
      vis("landuse-line", e.landuse);
      vis("reserves-fill", e.reserves);
      vis("reserves-line", e.reserves);
    };

    const applyPropertyLayer = () => {
      const want =
        propsRef.current.enabled.property && propsRef.current.propertyConfigured;
      const hasLayer = !!map.getLayer("property-raster");
      if (want && !hasLayer) {
        if (!map.getSource("src-property")) {
          map.addSource("src-property", {
            type: "raster",
            tiles: ["/api/lm-tiles?bbox={bbox-epsg-3857}"],
            tileSize: 256,
          });
        }
        const beforeId = map.getLayer("landuse-fill") ? "landuse-fill" : undefined;
        map.addLayer(
          {
            id: "property-raster",
            type: "raster",
            source: "src-property",
            paint: { "raster-opacity": 0.85 },
          },
          beforeId,
        );
      } else if (!want && hasLayer) {
        map.removeLayer("property-raster");
        if (map.getSource("src-property")) map.removeSource("src-property");
      }
    };

    applyRef.current = () => {
      applyVisibility();
      applyPropertyLayer();
    };

    const addSourcesAndLayers = () => {
      for (const kind of [...ALL_KINDS, "hemfridszon" as const]) {
        if (!map.getSource(`src-${kind}`)) {
          map.addSource(`src-${kind}`, { type: "geojson", data: EMPTY_FC });
        }
      }

      // Order: cultivated land at the bottom, buildings on top.
      map.addLayer({
        id: "landuse-fill",
        type: "fill",
        source: "src-landuse",
        paint: { "fill-color": OVERLAY_COLORS.landuse, "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "landuse-line",
        type: "line",
        source: "src-landuse",
        paint: { "line-color": OVERLAY_COLORS.landuse, "line-width": 1 },
      });

      map.addLayer({
        id: "hemfridszon-fill",
        type: "fill",
        source: "src-hemfridszon",
        paint: {
          "fill-color": OVERLAY_COLORS.hemfridszon,
          "fill-opacity": 0.15,
        },
      });
      map.addLayer({
        id: "hemfridszon-line",
        type: "line",
        source: "src-hemfridszon",
        paint: {
          "line-color": OVERLAY_COLORS.hemfridszon,
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "reserves-fill",
        type: "fill",
        source: "src-reserves",
        paint: { "fill-color": OVERLAY_COLORS.reserves, "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "reserves-line",
        type: "line",
        source: "src-reserves",
        paint: { "line-color": OVERLAY_COLORS.reserves, "line-width": 2 },
      });

      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "src-buildings",
        paint: { "fill-color": OVERLAY_COLORS.buildings, "fill-opacity": 0.45 },
      });
      map.addLayer({
        id: "buildings-line",
        type: "line",
        source: "src-buildings",
        paint: { "line-color": OVERLAY_COLORS.buildings, "line-width": 1 },
      });
    };

    const onReserveClick = (e: {
      lngLat: { lng: number; lat: number };
      features?: { properties?: Record<string, unknown> | null }[];
    }) => {
      const props = e.features?.[0]?.properties ?? {};
      const name =
        typeof props.name === "string" ? props.name : "Naturreservat";
      // OSM tags are world-editable, so validate the scheme before trusting
      // the value as a link target — blocks javascript:/data: URLs here.
      const website =
        safeHttpUrl(props.website) ?? safeHttpUrl(props["contact:website"]);
      const officialLink = website
        ? `<a href="${escapeHtml(website)}" target="_blank" rel="noreferrer" style="color:var(--primary);display:block;margin-bottom:2px">Officiell sida ↗</a>`
        : "";
      const html =
        `<div style="font-size:13px;line-height:1.45;max-width:220px">` +
        `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(name)}</div>` +
        `<div style="opacity:.7;margin-bottom:6px">Skyddat område – egna regler gäller. Läs beslut/skyltar på plats.</div>` +
        officialLink +
        `<a href="https://skyddadnatur.naturvardsverket.se/" target="_blank" rel="noreferrer" style="color:var(--primary);display:block">Naturvårdsverket: Skyddad natur ↗</a>` +
        `</div>`;
      new Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    map.on("load", () => {
      addSourcesAndLayers();
      applyVisibility();
      applyPropertyLayer();
      emitView();
      refreshOverlays();

      map.on("moveend", () => {
        emitView();
        emitAssessment();
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(refreshOverlays, 400);
      });

      // Long-press (touch) / press-and-hold (mouse) anywhere to assess that
      // exact spot — avoids casual taps dropping a marker. A picked point
      // supersedes GPS until you press the locate button again.
      const setPickedPoint = (p: LngLat) => {
        pickedRef.current = p;
        if (markerRef.current) {
          markerRef.current.setLngLat([p.lng, p.lat]);
        } else {
          markerRef.current = new Marker({ color: "#1f2937" })
            .setLngLat([p.lng, p.lat])
            .addTo(map);
        }
        emitAssessment();
      };

      const LONG_PRESS_MS = 500;
      const MOVE_TOLERANCE = 12;
      let pressStart: { x: number; y: number; lngLat: LngLat } | null = null;

      const cancelPress = () => {
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = undefined;
        pressStart = null;
      };

      const beginPress = (e: PressEvent) => {
        if (e.points && e.points.length > 1) {
          cancelPress(); // pinch / multi-touch is never a long-press
          return;
        }
        pressStart = {
          x: e.point.x,
          y: e.point.y,
          lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
        };
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => {
          if (pressStart) {
            setPickedPoint(pressStart.lngLat);
            pressStart = null;
          }
        }, LONG_PRESS_MS);
      };

      const cancelPressOnMove = (e: PressEvent) => {
        if (!pressStart) return;
        if (
          Math.hypot(e.point.x - pressStart.x, e.point.y - pressStart.y) >
          MOVE_TOLERANCE
        ) {
          cancelPress(); // it's a pan, not a hold
        }
      };

      map.on("mousedown", beginPress);
      map.on("touchstart", beginPress);
      map.on("mousemove", cancelPressOnMove);
      map.on("touchmove", cancelPressOnMove);
      map.on("mouseup", cancelPress);
      map.on("touchend", cancelPress);
      map.on("touchcancel", cancelPress);
      map.on("dragstart", cancelPress);
      map.on("movestart", cancelPress);
      map.on("zoomstart", cancelPress);

      map.on("click", "reserves-fill", onReserveClick);
      for (const layer of ["reserves-fill"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Try to centre on the user once, after the map is ready.
      window.setTimeout(() => {
        try {
          geolocate.trigger();
        } catch {
          /* ignore */
        }
      }, 800);
    });

    return () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(pressTimerRef.current);
      for (const kind of ALL_KINDS) abortControllers[kind]?.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- react to overlay toggles -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      // If style not ready yet, the load handler will apply initial state.
      return;
    }
    applyRef.current();
    refreshRef.current();
  }, [enabled, propertyConfigured]);

  return <div ref={containerRef} className="h-full w-full" />;
}

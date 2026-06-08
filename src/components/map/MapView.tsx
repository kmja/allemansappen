"use client";

import { useEffect, useRef } from "react";
import {
  Map as MlMap,
  Marker,
  NavigationControl,
  ScaleControl,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import { buffer } from "@turf/buffer";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import { getBasemap } from "@/lib/map/basemap";
import { CAUTION_COLOR, NOCAMP_COLOR, OVERLAY_COLORS } from "@/lib/map/layers";
import { getJson } from "@/lib/data/client";
import { safeHttpUrl } from "@/lib/url";
import { assessPosition } from "@/lib/assess";
import { OUT_LIMITS } from "@/lib/osm";
import {
  BUILDING_CAUTION_M,
  BUILDING_NOCAMP_M,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LOCATED_ZOOM,
  OVERPASS_MIN_ZOOM,
  PREFETCH_HALF_KM,
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
  const userMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const firstFixRef = useRef(true);
  const userInteractedRef = useRef(false);
  const prefetchAbortRef = useRef<Record<OverpassKind, AbortController | null>>({
    buildings: null,
    landuse: null,
    reserves: null,
  });
  const prefetchTimerRef = useRef<number | undefined>(undefined);
  const fetchMsRef = useRef<number | null>(null);

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
      const inBBox = (bbox: BBox | undefined) =>
        !!bbox &&
        point.lng >= bbox[0] &&
        point.lng <= bbox[2] &&
        point.lat >= bbox[1] &&
        point.lat <= bbox[3];
      const layer = (kind: OverpassKind) => {
        const resp = dataRef.current[kind];
        return {
          status: statusRef.current[kind],
          features: resp?.features ?? [],
          covers: inBBox(resp?.meta.bbox),
        };
      };
      cb({
        located: true,
        origin,
        point,
        positionInView,
        rules: assessPosition(point, {
          reserves: layer("reserves"),
          cultivated: layer("landuse"),
          buildings: layer("buildings"),
          positionInView,
          buildingNoCampM: BUILDING_NOCAMP_M,
          buildingCautionM: BUILDING_CAUTION_M,
        }),
      });
    };

    map.addControl(new NavigationControl({ showCompass: true }), "top-left");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    // User geolocation, managed directly so GPS mode updates continuously while
    // a placed pin (manual mode) freezes the assessment in place. The map
    // centres on the first fix and on an explicit locate, but doesn't chase.
    const ensureUserDot = (coords: LngLat) => {
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:16px;height:16px;border-radius:9999px;background:#1d4ed8;border:3px solid #fff;box-shadow:0 0 0 2px rgba(29,78,216,.35);pointer-events:none";
        userMarkerRef.current = new Marker({ element: el });
      }
      userMarkerRef.current.setLngLat([coords.lng, coords.lat]).addTo(map);
    };

    const onPosition = (pos: GeolocationPosition) => {
      const coords = { lng: pos.coords.longitude, lat: pos.coords.latitude };
      locatedRef.current = coords;
      ensureUserDot(coords);
      // Manual mode: keep the live dot, but freeze the assessment on the pin.
      if (pickedRef.current) return;
      // Centre on the first fix only, and never once the user has panned — so
      // browsing the map away from your location is never yanked back.
      if (firstFixRef.current && !userInteractedRef.current) {
        map.easeTo({
          center: [coords.lng, coords.lat],
          zoom: Math.max(map.getZoom(), LOCATED_ZOOM),
        });
      }
      firstFixRef.current = false;
      propsRef.current.onLocate?.(coords);
      emitAssessment();
    };

    const onPositionError = (err: GeolocationPositionError) => {
      propsRef.current.onLocateError?.(geolocationErrorMessage(err.code));
    };

    const startWatch = () => {
      if (watchIdRef.current != null) return;
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        propsRef.current.onLocateError?.(geolocationErrorMessage());
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPosition,
        onPositionError,
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
    };

    const goToMyLocation = () => {
      // Explicit return to GPS mode: drop any pin and recentre on the user.
      pickedRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      userInteractedRef.current = false; // re-enable centring on the next fix
      startWatch();
      const coords = locatedRef.current;
      if (coords) {
        map.easeTo({
          center: [coords.lng, coords.lat],
          zoom: Math.max(map.getZoom(), LOCATED_ZOOM),
        });
        propsRef.current.onLocate?.(coords);
        emitAssessment();
      } else {
        firstFixRef.current = true; // centre on the next fix
      }
    };

    propsRef.current.registerLocate?.(goToMyLocation);

    // A manual pan disables GPS auto-centring until the next explicit locate.
    map.on("dragstart", () => {
      userInteractedRef.current = true;
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

    const updateBuildingZones = () => {
      const outer = map.getSource("src-zone-outer") as GeoJSONSource | undefined;
      const inner = map.getSource("src-zone-inner") as GeoJSONSource | undefined;
      if (!outer || !inner) return;
      const buildings = dataRef.current.buildings;
      if (
        !propsRef.current.enabled.hemfridszon ||
        !buildings?.features.length
      ) {
        outer.setData(EMPTY_FC);
        inner.setData(EMPTY_FC);
        return;
      }
      try {
        const capped: FeatureCollection = {
          type: "FeatureCollection",
          features: buildings.features.slice(0, 500),
        };
        // Outer amber covers 0–CAUTION; inner red covers 0–NOCAMP and is drawn
        // on top, so the visible bands read red <60 m, amber 60–100 m.
        const out = buffer(capped, BUILDING_CAUTION_M, { units: "meters" });
        const inn = buffer(capped, BUILDING_NOCAMP_M, { units: "meters" });
        outer.setData(out ?? EMPTY_FC);
        inner.setData(inn ?? EMPTY_FC);
      } catch {
        outer.setData(EMPTY_FC);
        inner.setData(EMPTY_FC);
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

    // True when every needed layer's last fetch already covers this point — so
    // we can re-rule from cached data without hitting the network again.
    const coversPoint = (p: LngLat): boolean => {
      for (const kind of neededKinds()) {
        const bbox = dataRef.current[kind]?.meta.bbox;
        if (
          !bbox ||
          p.lng < bbox[0] ||
          p.lng > bbox[2] ||
          p.lat < bbox[1] ||
          p.lat > bbox[3]
        ) {
          return false;
        }
      }
      return true;
    };

    const fetchKind = async (kind: OverpassKind, bbox: BBox) => {
      abortRef.current[kind]?.abort();
      const ac = new AbortController();
      abortRef.current[kind] = ac;
      setStatus(kind, "loading");
      const t0 = performance.now();
      try {
        const data = await getJson<OverpassResponse>(
          `/api/overpass?kind=${kind}&bbox=${bbox.join(",")}`,
          ac.signal,
        );
        // Track how responsive Overpass is, to size the background prefetch.
        const dt = performance.now() - t0;
        fetchMsRef.current =
          fetchMsRef.current == null ? dt : fetchMsRef.current * 0.6 + dt * 0.4;
        dataRef.current[kind] = data;
        setSourceData(kind, data);
        setStatus(kind, data.features.length ? "ready" : "empty");
        if (kind === "buildings") updateBuildingZones();
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
          dataRef.current[kind] = null;
          setSourceData(kind, EMPTY_FC);
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
      updateBuildingZones();
    };
    refreshRef.current = refreshOverlays;

    // Background prefetch: after a pin settles, quietly pull a larger surround so
    // nearby spots rule instantly. No loading state (silent), and a truncated
    // (dense-area) result is ignored so it never replaces the more accurate
    // immediate fetch near the point — only sparse areas grow coverage.
    const prefetchAround = (center: LngLat) => {
      if (map.getZoom() < OVERPASS_MIN_ZOOM) return;
      // Grab more area when Overpass is responding fast (sparse/forest), less —
      // or nothing — when it's slow. Default until we have a measurement.
      const ms = fetchMsRef.current;
      const halfKm =
        ms == null
          ? PREFETCH_HALF_KM
          : Math.max(0, Math.min(7, (7 * (2000 - ms)) / 1600));
      if (halfKm < 3) return; // too small to be worth a request
      const latHalf = halfKm / 111;
      const lngHalf = halfKm / (111 * Math.cos((center.lat * Math.PI) / 180));
      const bbox: BBox = [
        center.lng - lngHalf,
        center.lat - latHalf,
        center.lng + lngHalf,
        center.lat + latHalf,
      ];
      for (const kind of neededKinds()) {
        const have = dataRef.current[kind]?.meta.bbox;
        if (
          have &&
          have[0] <= bbox[0] &&
          have[1] <= bbox[1] &&
          have[2] >= bbox[2] &&
          have[3] >= bbox[3]
        ) {
          continue; // already covered by an equal/larger fetch
        }
        prefetchAbortRef.current[kind]?.abort();
        const ac = new AbortController();
        prefetchAbortRef.current[kind] = ac;
        getJson<OverpassResponse>(
          `/api/overpass?kind=${kind}&bbox=${bbox.join(",")}`,
          ac.signal,
        )
          .then((data) => {
            // Truncated dense-area result -> keep the accurate immediate fetch.
            if (data.features.length >= OUT_LIMITS[kind] * 0.9) return;
            dataRef.current[kind] = data;
            setSourceData(kind, data);
            statusRef.current[kind] = data.features.length ? "ready" : "empty";
            propsRef.current.onStatusChange?.({ ...statusRef.current });
            if (kind === "buildings") updateBuildingZones();
            emitAssessment();
          })
          .catch(() => {
            /* background; ignore (including aborts) */
          });
      }
    };

    const schedulePrefetch = (center: LngLat) => {
      window.clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = window.setTimeout(
        () => prefetchAround(center),
        600,
      );
    };

    const applyVisibility = () => {
      const e = propsRef.current.enabled;
      const vis = (id: string, on: boolean) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
        }
      };
      vis("buildings-fill", e.buildings);
      vis("buildings-line", e.buildings);
      vis("zone-outer-fill", e.hemfridszon);
      vis("zone-outer-line", e.hemfridszon);
      vis("zone-inner-fill", e.hemfridszon);
      vis("zone-inner-line", e.hemfridszon);
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
      for (const id of [
        "src-buildings",
        "src-landuse",
        "src-reserves",
        "src-zone-outer",
        "src-zone-inner",
      ]) {
        if (!map.getSource(id)) {
          map.addSource(id, { type: "geojson", data: EMPTY_FC });
        }
      }

      // Bottom -> top: cultivated land, reserves, the amber 60–100 m building
      // band, the red <60 m no-camp band, then buildings on top.
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
        id: "zone-outer-fill",
        type: "fill",
        source: "src-zone-outer",
        paint: { "fill-color": CAUTION_COLOR, "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: "zone-outer-line",
        type: "line",
        source: "src-zone-outer",
        paint: {
          "line-color": CAUTION_COLOR,
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "zone-inner-fill",
        type: "fill",
        source: "src-zone-inner",
        paint: { "fill-color": NOCAMP_COLOR, "fill-opacity": 0.33 },
      });
      map.addLayer({
        id: "zone-inner-line",
        type: "line",
        source: "src-zone-inner",
        paint: { "line-color": NOCAMP_COLOR, "line-width": 1.2 },
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

      // OSM tags are world-editable, so every link target is scheme-validated
      // (safeHttpUrl) before it reaches an href.
      const link = (href: string, label: string) =>
        `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" style="color:var(--primary);display:block;margin-top:3px">${label}</a>`;
      const links: string[] = [];

      const website =
        safeHttpUrl(props.website) ?? safeHttpUrl(props["contact:website"]);
      if (website) links.push(link(website, "Officiell sida ↗"));

      // OSM "wikipedia" tag looks like "sv:Artikelnamn".
      const wiki =
        typeof props.wikipedia === "string"
          ? /^([a-z]{2,3}):(.+)$/i.exec(props.wikipedia)
          : null;
      if (wiki) {
        const wikiUrl = safeHttpUrl(
          `https://${wiki[1].toLowerCase()}.wikipedia.org/wiki/${encodeURIComponent(
            wiki[2].replace(/ /g, "_"),
          )}`,
        );
        if (wikiUrl) links.push(link(wikiUrl, "Wikipedia ↗"));
      }

      // The actual local rules are the reserve's föreskrifter — search them out.
      const search = `https://www.google.com/search?q=${encodeURIComponent(
        `${name} naturreservat föreskrifter`,
      )}`;
      links.push(link(search, "Sök föreskrifter (lokala regler) ↗"));
      links.push(
        link(
          "https://skyddadnatur.naturvardsverket.se/",
          "Naturvårdsverket: Skyddad natur ↗",
        ),
      );

      const html =
        `<div style="font-size:13px;line-height:1.45;max-width:240px">` +
        `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(name)}</div>` +
        `<div style="opacity:.75;margin-bottom:4px">Skyddat område med egna <b>föreskrifter</b> – ofta begränsas eldning och tältning. Läs reglerna innan du tältar:</div>` +
        links.join("") +
        `</div>`;
      new Popup({ closeButton: true, maxWidth: "280px" })
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
        // Manual mode (a pin is placed) is a frozen snapshot: panning must not
        // refetch overlays or re-evaluate, so the ruling stays put.
        if (pickedRef.current) return;
        emitAssessment();
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(refreshOverlays, 400);
      });

      // Single tap places (or moves) the pin; long-press the pin to grab it (it
      // lifts) and drag it around. A picked point supersedes GPS until you press
      // the locate button.
      let suppressClickUntil = 0;

      const setPickedPoint = (p: LngLat) => {
        pickedRef.current = p;
        if (markerRef.current) {
          markerRef.current.setLngLat([p.lng, p.lat]);
        } else {
          markerRef.current = new Marker({
            element: createPinElement(),
            anchor: "bottom",
          })
            .setLngLat([p.lng, p.lat])
            .addTo(map);
        }
        emitAssessment();
        // Only fetch when the existing data doesn't already cover the new pin,
        // so nudging within the loaded area is instant (no refetch).
        if (!coversPoint(p)) refreshOverlays();
        // …then grow coverage around it in the background for nearby checks.
        schedulePrefetch(p);
      };

      // Lightweight live move during a drag — re-rules from already-loaded data
      // (instant); the refetch/prefetch runs once on drop.
      const movePin = (p: LngLat) => {
        pickedRef.current = p;
        markerRef.current?.setLngLat([p.lng, p.lat]);
        emitAssessment();
      };

      // The pin element. Long-press (~300 ms) to "grab" it — it lifts off the
      // map — then drag to reposition; release to drop and re-rule.
      function createPinElement(): HTMLElement {
        const el = document.createElement("div");
        el.style.cssText = "width:26px;height:34px;cursor:grab;touch-action:none";
        const inner = document.createElement("div");
        inner.style.cssText =
          "width:26px;height:34px;transform-origin:50% 100%;transition:transform .12s ease,filter .15s ease;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))";
        inner.innerHTML =
          '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M13 1C6.4 1 1 6.4 1 13c0 8.8 12 19.5 12 19.5S25 21.8 25 13C25 6.4 19.6 1 13 1z" fill="#1f2937" stroke="#fff" stroke-width="2"/>' +
          '<circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>';
        el.appendChild(inner);

        let grabbed = false;
        let grabTimer: number | undefined;
        let startX = 0;
        let startY = 0;
        let pending: LngLat | null = null;
        let raf = 0;

        const containerXY = (ev: PointerEvent): [number, number] => {
          const r = map.getContainer().getBoundingClientRect();
          return [ev.clientX - r.left, ev.clientY - r.top];
        };
        const lift = (on: boolean) => {
          inner.style.transform = on ? "translateY(-9px) scale(1.12)" : "";
          inner.style.filter = on
            ? "drop-shadow(0 10px 7px rgba(0,0,0,.4))"
            : "drop-shadow(0 2px 2px rgba(0,0,0,.35))";
          el.style.cursor = on ? "grabbing" : "grab";
        };

        const onMove = (ev: PointerEvent) => {
          if (!grabbed) {
            if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 12) {
              window.clearTimeout(grabTimer); // moved before the hold fired
            }
            return;
          }
          const ll = map.unproject(containerXY(ev));
          pending = { lng: ll.lng, lat: ll.lat };
          markerRef.current?.setLngLat([ll.lng, ll.lat]); // follow immediately
          if (!raf) {
            raf = requestAnimationFrame(() => {
              raf = 0;
              if (pending) movePin(pending); // throttle the re-rule to a frame
            });
          }
        };
        const onUp = (ev: PointerEvent) => {
          window.clearTimeout(grabTimer);
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
          if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
          if (grabbed) {
            grabbed = false;
            lift(false);
            map.dragPan.enable();
            suppressClickUntil = performance.now() + 400; // swallow the drop's click
            if (pending) setPickedPoint(pending);
          }
          pending = null;
        };

        el.addEventListener("pointerdown", (ev: PointerEvent) => {
          ev.stopPropagation(); // don't pan/place from a press on the pin
          startX = ev.clientX;
          startY = ev.clientY;
          pending = null;
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerup", onUp);
          el.addEventListener("pointercancel", onUp);
          window.clearTimeout(grabTimer);
          grabTimer = window.setTimeout(() => {
            grabbed = true;
            lift(true);
            map.dragPan.disable();
            try {
              el.setPointerCapture(ev.pointerId);
            } catch {
              /* capture unsupported */
            }
          }, 300);
        });

        return el;
      }

      map.on("click", (e) => {
        if (performance.now() < suppressClickUntil) return;
        setPickedPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      map.on("click", "reserves-fill", onReserveClick);
      for (const layer of ["reserves-fill"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Begin continuously watching the user's location once the map is ready.
      startWatch();
    });

    return () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(prefetchTimerRef.current);
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      for (const kind of ALL_KINDS) abortControllers[kind]?.abort();
      for (const kind of ALL_KINDS) prefetchAbortRef.current[kind]?.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
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

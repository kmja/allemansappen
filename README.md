# Friluftslivshjälp — "Kan jag tälta här?"

A map app for the Swedish outdoors that helps you reason about **camping under
allemansrätten** — not by drawing a confident green "camp here" zone (that would
be wrong in edge cases and a liability trap), but by **overlaying the relevant
data layers** around you and stating the allemansrätten principles, then letting
you make an informed judgment.

> **The honest framing (this is the whole point).** Allemansrätten does *not*
> map cleanly to "green = legal." The app shows information and principles; it
> **does not tell you it is legal to camp somewhere.** Anything time-sensitive
> (weather, fire ban) is timestamped, and we link out to official sources rather
> than restating rules that go stale.

## What it shows

- **Topographic basemap** (OpenStreetMap by default; swappable for Lantmäteriet
  topo or a vector style).
- **Buildings** — the reasoning aid for *hemfridszon* (the private zone around a
  dwelling). There is no national hemfridszon polygon; showing buildings lets you
  apply the ~60–70 m intuition yourself.
- **Hemfridszon (indicative)** — an optional, clearly-labelled ~65 m soft buffer
  around buildings. Vägledande only — never asserted as a legal boundary.
- **Cultivated land** (åker, äng, planteringar…) where camping should be avoided.
- **Nature reserves** — tap a reserve to open its official page (we link out; we
  do **not** restate per-reserve rules from parsed PDFs).
- **Property boundaries** (Lantmäteriet) — optional, requires configured access.
- **Fire ban (eldningsförbud)** — an honest banner that does **not** assert
  "no ban"; it frames the question and links to your länsstyrelse.
- **Weather** — SMHI point forecast, timestamped.
- **GPS centring**, an always-accessible **allemansrätten principles** panel, and
  a first-run explainer of what the app does and doesn't do.

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui**
- **MapLibre GL** for the map (vector/GPU rendering; stacks many overlay layers
  smoothly, and avoids the SSR import dance Leaflet forces).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
# or
npm run build && npm run start
```

No API keys are required for the default experience. Copy `.env.example` to
`.env.local` only if you want to enable optional layers (see below).

### Tests & CI

```bash
npm test          # vitest run
npm run test:watch
```

Two layers of tests, run in CI (lint + test + build) on every push and PR via
`.github/workflows/ci.yml`:

- **Pure data logic** (`src/lib/__tests__/`) — Overpass query building, the
  OSM→GeoJSON conversion (ways, multipolygon relations, ring-closing, tag
  passthrough), the SMHI forecast parser, the fire-ban resolver, the geo/county
  helpers, and the untrusted-URL sanitiser.
- **Component behaviour** (`src/components/**/__tests__/`) — the honest-framing
  UI: the fire-ban banner never claims "no ban", weather falls back to cached
  data when offline, the property toggle stays disabled until configured, and
  the principles panel links out to official sources.

These cover the parts that can't be exercised against live APIs in a sandbox.

### Install as an app / offline

The app is a PWA: it ships a web manifest + service worker (`public/sw.js`) and
can be installed to a phone home screen. Offline behaviour is intentionally
conservative — navigations and API calls are **network-first** (online always
wins), while **map tiles you've already viewed are cached** so a previously
seen area still renders without signal. An "Offline – visar sparad data" badge
appears when connectivity drops. (A deliberate "download this area" prefetch is
still on the roadmap.)

## Data sources

| Layer | Source | Needs a key? |
| --- | --- | --- |
| Basemap (topo) | OpenStreetMap raster | No (swappable via env) |
| Buildings / cultivated land / reserves | OpenStreetMap via **Overpass** | No |
| Hemfridszon (indicative) | Derived from buildings (`@turf/buffer`) | No |
| Weather | **SMHI** open API | No |
| Fire ban | Honest link-out to länsstyrelse / MSB | No |
| Property boundaries | **Lantmäteriet** (proxied) | **Yes** |

OpenStreetMap data is fetched **on demand** for the current map view through the
cached route handler `/api/overpass` (it pauses below a minimum zoom and prompts
you to zoom in). Each layer **degrades gracefully** when it can't load — which is
also the intended behaviour when you're offline in the forest.

### Configuring property boundaries (Lantmäteriet)

Cadastral data is the access-friction layer. Credentials are read **only on the
server** and proxied through `/api/lm-tiles`, so the secret never reaches the
browser. In `.env.local`:

```bash
NEXT_PUBLIC_PROPERTY_LAYER_ENABLED=true
LANTMATERIET_WMS_TEMPLATE=...{bbox}...   # WMS GetMap template; {bbox} = EPSG:3857 bbox
LANTMATERIET_TOKEN=...                    # or LANTMATERIET_USERNAME / _PASSWORD
```

Until configured, the property toggle shows "requires configured access" instead
of failing silently.

### Swapping the basemap

```bash
NEXT_PUBLIC_BASEMAP_STYLE_URL=https://example.com/style.json
```

> ⚠️ The default OSM raster tiles are fine for development but are subject to the
> [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
> Use a basemap that permits your volume before shipping to real users.

## ⚠️ What still needs live verification

This project was scaffolded in a sandbox whose network policy blocks the geo/
weather APIs, so the **data fetches could not be exercised against the live
endpoints** — they run in your browser / server when you actually run the app.
Before relying on it, verify in your environment:

1. **Overpass** returns data for `/api/overpass?kind=buildings&bbox=…` and the
   OSM→GeoJSON conversion renders correctly (multipolygon reserves in
   particular — inner rings/holes are not subtracted; see
   `src/lib/server/overpass.ts`).
2. **SMHI** `/api/weather?lat=…&lon=…` returns a forecast for Swedish
   coordinates.
3. **Lantmäteriet** product/endpoint and auth scheme for the property layer.
4. The **länsstyrelse / official links** in `src/lib/lanstyrelser.ts` and
   `src/lib/allemansratten.ts` still resolve.

## Architecture

```
src/
  app/
    page.tsx               # renders <AppShell/>
    layout.tsx             # sv-SE, viewport, system font (no network font fetch)
    api/
      overpass/route.ts    # OSM buildings/landuse/reserves -> GeoJSON (cached)
      weather/route.ts     # SMHI proxy (cached, timestamped)
      fire-ban/route.ts    # honest eldningsförbud resolver + link-outs
      lm-tiles/route.ts    # secure Lantmäteriet WMS proxy (server-side creds)
  components/
    AppShell.tsx           # client orchestrator (state, layout, sheets)
    map/MapView.tsx        # MapLibre map, overlays, GPS, reserve popups
    panels/                # FireBanBanner, WeatherCard, LayerToggles,
                           # PrinciplesPanel, FirstRunExplainer, Disclaimer
    ui/                    # shadcn/ui components
  lib/
    server/                # server-only data fetchers (overpass, smhi, fireban)
    map/                   # basemap + overlay registry
    allemansratten.ts      # principles content + official links
    lanstyrelser.ts        # counties + fire-ban link-outs
    config.ts, geo.ts, cache.ts, hooks.ts, types.ts
```

**Offline-aware by design:** weather and fire-ban responses are cached in
`localStorage` with a visible "checked at" timestamp, so a stale offline value is
never mistaken for a live one. A service worker additionally caches viewed map
tiles and the app shell, with bounded caches so a long session can't grow them
without limit (see `public/sw.js`). A deliberate "download this area" tile
prefetch is the remaining offline piece.

**Untrusted data is treated as untrusted:** OpenStreetMap tags are
world-editable, so any value rendered into a reserve popup is HTML-escaped, and a
link target (a reserve's `website`) is dropped unless it parses as an absolute
http(s) URL — a `javascript:`/`data:` scheme never reaches an `href`
(`src/lib/url.ts`).

## Explicitly NOT in scope (by design)

- ❌ No "green = camp here" verdict polygon.
- ❌ No restated per-reserve rules from parsed PDFs — link out instead.
- ❌ No hard hemfridszon boundary asserted as fact.

## Roadmap

- "Download this area" tile prefetch for guaranteed offline coverage (the
  service worker already caches viewed tiles opportunistically).
- A real eldningsförbud feed (the `FireBanResult` shape already supports
  `ban` / `no-ban` so the UI won't change when a source is wired in).
- Reserve detail via Naturvårdsverket "Skyddad natur" instead of OSM tags.
- Auto-detect the county for the fire-ban link-out (kept manual for now to
  avoid asserting a wrong county — the trust-killer the whole app guards
  against).

/*
 * Service worker for Friluftslivshjälp.
 *
 * Conservative by design so a buggy SW can never serve broken content:
 *   - Navigations & API GETs: network-first (online always wins), with an
 *     offline fallback to the cached app shell / last response.
 *   - Map tiles: cache-first with a bounded cache, so areas you've already
 *     viewed remain available offline in the forest.
 *   - Immutable static assets (/_next/static, icon, manifest): cache-first.
 * All cache work is wrapped so a failure degrades to a plain network fetch.
 */

const VERSION = "v1";
const STATIC_CACHE = `fch-static-${VERSION}`;
const TILE_CACHE = "fch-tiles";
const TILE_CAP = 600;
// API GETs (overpass/weather/fire-ban) are keyed by a continuously-varying
// bbox, so they live in their own bounded cache rather than growing the app
// shell cache without limit.
const API_CACHE = "fch-api";
const API_CAP = 80;
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("fch-static-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isTile(url) {
  return (
    /\/\d+\/\d+\/\d+\.(png|jpe?g|webp)(\?|$)/.test(url.pathname) ||
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.startsWith("tile.")
  );
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(
      keys.slice(0, keys.length - max).map((k) => cache.delete(k)),
    );
  }
}

async function cacheFirst(request, cacheName, cap) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  try {
    await cache.put(request, res.clone());
    if (cap) trimCache(cacheName, cap);
  } catch {
    /* opaque/uncacheable — still return the response */
  }
  return res;
}

async function networkFirst(request, cacheName, { fallbackUrl, cap } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    // Only cache successful responses, so an offline replay never serves a
    // cached 4xx/5xx back as if it were real data.
    if (res.ok) {
      try {
        await cache.put(request, res.clone());
        if (cap) trimCache(cacheName, cap);
      } catch {
        /* ignore */
      }
    }
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fb = await cache.match(fallbackUrl);
      if (fb) return fb;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isTile(url)) {
    event.respondWith(
      cacheFirst(request, TILE_CACHE, TILE_CAP).catch(() => fetch(request)),
    );
    return;
  }

  // Beyond tiles we only manage same-origin requests.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE, { fallbackUrl: "/" }));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      networkFirst(request, API_CACHE, { cap: API_CAP }).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    PRECACHE.includes(url.pathname) ||
    /\.(svg|png|ico|css|js|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      cacheFirst(request, STATIC_CACHE).catch(() => fetch(request)),
    );
  }
});

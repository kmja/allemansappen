import "server-only";

import { countyByName } from "../lanstyrelser";

const OVERPASS_URL =
  process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

const USER_AGENT =
  "FriluftslivCampingHelper/0.1 (allemansrätten map; +https://github.com/kmja/allemansappen)";

/**
 * Detect the Swedish county (län) containing a point via Overpass `is_in`
 * (admin_level=4 administrative boundary). Returns null if nothing matches.
 */
export async function detectCounty(
  lat: number,
  lon: number,
): Promise<{ code: string; name: string } | null> {
  const query = `[out:json][timeout:15];is_in(${lat},${lon})->.a;area.a["admin_level"="4"]["boundary"="administrative"];out tags;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Overpass svarade ${res.status}`);
  const json = (await res.json()) as {
    elements?: { tags?: Record<string, string> }[];
  };
  for (const el of json.elements ?? []) {
    const county = countyByName(el.tags?.name);
    if (county) return { code: county.code, name: county.name };
  }
  return null;
}

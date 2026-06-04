import "server-only";

import type { WeatherResult } from "../types";
import { roundCoord } from "../geo";
import { parseForecast, type SmhiTimeSeries } from "../weather-core";

export { weatherSymbolText } from "../weather-core";

const USER_AGENT =
  "FriluftslivCampingHelper/0.1 (allemansrätten map; +https://github.com/kmja/allemansappen)";

/**
 * SMHI point forecast (open data, no key). Throws on non-2xx or out-of-domain
 * coordinates so the caller can surface an honest "unavailable / offline" state.
 */
export async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherResult> {
  const rlat = roundCoord(lat, 4);
  const rlon = roundCoord(lon, 4);
  const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${rlon}/lat/${rlat}/data.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`SMHI svarade ${res.status}`);
  }

  const json = (await res.json()) as { timeSeries?: SmhiTimeSeries[] };
  return parseForecast(json.timeSeries ?? [], Date.now());
}

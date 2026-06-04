import "server-only";

import type { WeatherResult } from "../types";
import { roundCoord } from "../geo";

const USER_AGENT =
  "FriluftslivCampingHelper/0.1 (allemansrätten map; +https://github.com/kmja/allemansappen)";

/** SMHI Wsymb2 (1–27) → plain Swedish. */
const WSYMB2_SV: Record<number, string> = {
  1: "Klart",
  2: "Mestadels klart",
  3: "Växlande molnighet",
  4: "Halvklart",
  5: "Molnigt",
  6: "Mulet",
  7: "Dimma",
  8: "Lätta regnskurar",
  9: "Måttliga regnskurar",
  10: "Kraftiga regnskurar",
  11: "Åskväder",
  12: "Lätta byar av snöblandat regn",
  13: "Måttliga byar av snöblandat regn",
  14: "Kraftiga byar av snöblandat regn",
  15: "Lätta snöbyar",
  16: "Måttliga snöbyar",
  17: "Kraftiga snöbyar",
  18: "Lätt regn",
  19: "Måttligt regn",
  20: "Kraftigt regn",
  21: "Åska",
  22: "Lätt snöblandat regn",
  23: "Måttligt snöblandat regn",
  24: "Kraftigt snöblandat regn",
  25: "Lätt snöfall",
  26: "Måttligt snöfall",
  27: "Kraftigt snöfall",
};

export function weatherSymbolText(symbol: number | null): string {
  if (symbol == null) return "Okänt";
  return WSYMB2_SV[symbol] ?? "Okänt";
}

interface SmhiParameter {
  name: string;
  values: number[];
}
interface SmhiTimeSeries {
  validTime: string;
  parameters: SmhiParameter[];
}

/**
 * SMHI point forecast (open data, no key). Returns the forecast entry closest
 * to "now". Throws on non-2xx or out-of-domain coordinates so the caller can
 * surface an honest "unavailable / offline" state.
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
  const series = json.timeSeries ?? [];
  const now = Date.now();
  const entry =
    series.find((s) => new Date(s.validTime).getTime() >= now) ?? series[0];

  const read = (name: string): number | null => {
    const p = entry?.parameters?.find((x) => x.name === name);
    const v = p?.values?.[0];
    return typeof v === "number" ? v : null;
  };

  const symbol = read("Wsymb2");

  return {
    temperatureC: read("t"),
    windMs: read("ws"),
    windGustMs: read("gust"),
    precipMm: read("pmean"),
    symbol: symbol != null ? Math.round(symbol) : null,
    description: weatherSymbolText(symbol != null ? Math.round(symbol) : null),
    checkedAt: new Date().toISOString(),
    source: "SMHI",
    sourceUrl: "https://www.smhi.se/vader/prognoser/",
  };
}

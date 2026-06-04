import type { WeatherResult } from "./types";

/** SMHI Wsymb2 (1–27) → plain Swedish. */
export const WSYMB2_SV: Record<number, string> = {
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

export interface SmhiTimeSeries {
  validTime: string;
  parameters: { name: string; values: number[] }[];
}

/**
 * Parse an SMHI point forecast into our WeatherResult, choosing the entry
 * closest to (and not before) `nowMs`, falling back to the first entry. Pure
 * so it can be unit-tested with fixtures.
 */
export function parseForecast(
  timeSeries: SmhiTimeSeries[],
  nowMs: number,
): WeatherResult {
  const entry =
    timeSeries.find((s) => new Date(s.validTime).getTime() >= nowMs) ??
    timeSeries[0];

  const read = (name: string): number | null => {
    const p = entry?.parameters?.find((x) => x.name === name);
    const v = p?.values?.[0];
    return typeof v === "number" ? v : null;
  };

  const rawSymbol = read("Wsymb2");
  const symbol = rawSymbol != null ? Math.round(rawSymbol) : null;

  return {
    temperatureC: read("t"),
    windMs: read("ws"),
    windGustMs: read("gust"),
    precipMm: read("pmean"),
    symbol,
    description: weatherSymbolText(symbol),
    checkedAt: new Date(nowMs).toISOString(),
    source: "SMHI",
    sourceUrl: "https://www.smhi.se/vader/prognoser/",
  };
}

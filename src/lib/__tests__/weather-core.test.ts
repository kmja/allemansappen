import { describe, expect, it } from "vitest";
import {
  parseForecast,
  weatherSymbolText,
  type SmhiTimeSeries,
} from "@/lib/weather-core";

describe("weatherSymbolText", () => {
  it("maps known symbols to Swedish", () => {
    expect(weatherSymbolText(1)).toBe("Klart");
    expect(weatherSymbolText(6)).toBe("Mulet");
    expect(weatherSymbolText(27)).toBe("Kraftigt snöfall");
  });
  it("handles null and unknown codes", () => {
    expect(weatherSymbolText(null)).toBe("Okänt");
    expect(weatherSymbolText(99)).toBe("Okänt");
  });
});

function entry(time: string, params: Record<string, number>): SmhiTimeSeries {
  return {
    validTime: time,
    parameters: Object.entries(params).map(([name, v]) => ({
      name,
      values: [v],
    })),
  };
}

describe("parseForecast", () => {
  const series: SmhiTimeSeries[] = [
    entry("2026-06-04T11:00:00Z", { t: 9, ws: 2, pmean: 0, Wsymb2: 1 }),
    entry("2026-06-04T12:00:00Z", { t: 12, ws: 4, pmean: 0.3, Wsymb2: 5.0 }),
    entry("2026-06-04T13:00:00Z", { t: 14, ws: 5, pmean: 1, Wsymb2: 18 }),
  ];

  it("selects the entry at or after now", () => {
    const now = Date.parse("2026-06-04T11:30:00Z");
    const r = parseForecast(series, now);
    expect(r.temperatureC).toBe(12);
    expect(r.windMs).toBe(4);
    expect(r.precipMm).toBe(0.3);
    expect(r.symbol).toBe(5);
    expect(r.description).toBe("Molnigt");
    expect(r.checkedAt).toBe(new Date(now).toISOString());
    expect(r.source).toBe("SMHI");
  });

  it("falls back to the first entry when all are in the past", () => {
    const now = Date.parse("2026-06-04T20:00:00Z");
    const r = parseForecast(series, now);
    expect(r.temperatureC).toBe(9);
  });

  it("returns nulls for missing parameters", () => {
    const r = parseForecast([entry("2026-06-04T12:00:00Z", {})], Date.now());
    expect(r.temperatureC).toBeNull();
    expect(r.symbol).toBeNull();
    expect(r.description).toBe("Okänt");
  });
});

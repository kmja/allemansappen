// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { WeatherCard } from "@/components/panels/WeatherCard";
import { saveCache } from "@/lib/cache";
import type { WeatherResult } from "@/lib/types";

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

const weather: WeatherResult = {
  temperatureC: 12.4,
  windMs: 3.2,
  windGustMs: 6,
  precipMm: 0,
  symbol: 5,
  description: "Molnigt",
  checkedAt: new Date().toISOString(),
  source: "SMHI",
  sourceUrl: "https://www.smhi.se/",
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WeatherCard", () => {
  it("renders the fetched temperature and description", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(weather)));
    render(<WeatherCard anchor={{ lat: 59.33, lng: 18.06 }} />);

    expect(await screen.findByText("12°")).toBeInTheDocument();
    expect(screen.getByText("Molnigt")).toBeInTheDocument();
  });

  it("falls back to cached data when the fetch fails (offline)", async () => {
    saveCache<WeatherResult>("weather:59.33,18.06", {
      ...weather,
      temperatureC: 7,
      description: "Mulet",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<WeatherCard anchor={{ lat: 59.33, lng: 18.06 }} />);

    expect(await screen.findByText("7°")).toBeInTheDocument();
    expect(screen.getByText("Mulet")).toBeInTheDocument();
  });

  it("renders nothing without a position", () => {
    const { container } = render(<WeatherCard anchor={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

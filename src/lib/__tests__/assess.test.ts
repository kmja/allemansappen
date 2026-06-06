import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import {
  assessCultivated,
  assessFire,
  assessHemfridszon,
  assessPosition,
  assessReserve,
  distanceToFeaturesMeters,
  haversineMeters,
  pointInFeature,
  pointInRing,
  type OverlayInput,
} from "@/lib/assess";
import type { DataStatus, LngLat } from "@/lib/types";

/** Axis-aligned square polygon centred on (cx,cy), half-width `h` degrees. */
function square(cx: number, cy: number, h: number, props = {}): Feature {
  return {
    type: "Feature",
    properties: props,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [cx - h, cy - h],
          [cx + h, cy - h],
          [cx + h, cy + h],
          [cx - h, cy + h],
          [cx - h, cy - h],
        ],
      ],
    },
  };
}

const ready = (features: Feature[]): OverlayInput => ({
  status: "ready",
  features,
  covers: true,
});
const stale = (status: DataStatus): OverlayInput => ({
  status,
  features: [],
  covers: false,
});

describe("pointInRing / pointInFeature", () => {
  const ring = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];
  it("detects inside and outside", () => {
    expect(pointInRing(1, 1, ring)).toBe(true);
    expect(pointInRing(3, 1, ring)).toBe(false);
    expect(pointInRing(-1, 1, ring)).toBe(false);
  });
  it("works through pointInFeature for polygons", () => {
    expect(pointInFeature({ lng: 1, lat: 1 }, square(1, 1, 1))).toBe(true);
    expect(pointInFeature({ lng: 5, lat: 5 }, square(1, 1, 1))).toBe(false);
  });
  it("supports MultiPolygon outer rings", () => {
    const mp: Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [10, 10],
              [12, 10],
              [12, 12],
              [10, 12],
              [10, 10],
            ],
          ],
        ],
      },
    };
    expect(pointInFeature({ lng: 11, lat: 11 }, mp)).toBe(true);
    expect(pointInFeature({ lng: 0, lat: 0 }, mp)).toBe(false);
  });
});

describe("haversineMeters", () => {
  it("~111 km per degree of latitude", () => {
    const d = haversineMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 1 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("distanceToFeaturesMeters", () => {
  it("is 0 inside a feature", () => {
    expect(
      distanceToFeaturesMeters({ lng: 0, lat: 0 }, [square(0, 0, 0.001)]),
    ).toBe(0);
  });
  it("approximates distance to a nearby building edge", () => {
    // Building ~0.001deg (~111 m) north, tiny footprint -> edge ~100 m away.
    const d = distanceToFeaturesMeters({ lng: 0, lat: 0 }, [
      square(0, 0.001, 0.00005),
    ]);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
  it("is Infinity with no features", () => {
    expect(distanceToFeaturesMeters({ lng: 0, lat: 0 }, [])).toBe(Infinity);
  });
});

const P: LngLat = { lng: 0, lat: 0 };

describe("assessReserve", () => {
  it("avoid when inside a reserve, naming it", () => {
    const r = assessReserve(P, ready([square(0, 0, 0.01, { name: "Tivedens NP" })]), true);
    expect(r.verdict).toBe("avoid");
    expect(r.detail).toContain("Tivedens NP");
  });
  it("clear when outside any reserve", () => {
    const r = assessReserve(P, ready([square(5, 5, 0.01)]), true);
    expect(r.verdict).toBe("clear");
  });
  it("shows non-verdicts only when there is no covering data", () => {
    expect(assessReserve(P, stale("loading"), true).verdict).toBe("checking");
    expect(assessReserve(P, stale("zoom"), true).verdict).toBe("unknown");
    // in view but data is for another area (refetch pending)
    expect(assessReserve(P, stale("ready"), true).verdict).toBe("checking");
    // off-screen with no covering data
    expect(assessReserve(P, stale("ready"), false).verdict).toBe("unknown");
  });
  it("uses covering data even off-screen, staying stable while panning", () => {
    expect(assessReserve(P, ready([]), false).verdict).toBe("clear");
  });
});

describe("assessCultivated", () => {
  it("avoid on cultivated land, clear otherwise", () => {
    expect(assessCultivated(P, ready([square(0, 0, 0.01)]), true).verdict).toBe("avoid");
    expect(assessCultivated(P, ready([]), true).verdict).toBe("clear");
  });
});

describe("assessHemfridszon", () => {
  it("avoid when standing on a building", () => {
    expect(
      assessHemfridszon(P, ready([square(0, 0, 0.0005)]), true, 60, 100).verdict,
    ).toBe("avoid");
  });
  it("avoid within the no-camp distance (<60 m)", () => {
    // building centre ~0.0003 deg (~33 m) away -> within 60 m
    const r = assessHemfridszon(
      P,
      ready([square(0, 0.0003, 0.00003)]),
      true,
      60,
      100,
    );
    expect(r.verdict).toBe("avoid");
    expect(r.headline).toContain("Inom 60 m");
  });
  it("judgment in the 60–100 m caution band", () => {
    // ~0.0007 deg (~78 m)
    const r = assessHemfridszon(
      P,
      ready([square(0, 0.0007, 0.00003)]),
      true,
      60,
      100,
    );
    expect(r.verdict).toBe("judgment");
    expect(r.headline).toMatch(/m till byggnad/);
  });
  it("clear beyond the caution distance (>100 m)", () => {
    // ~0.0012 deg (~133 m)
    const r = assessHemfridszon(
      P,
      ready([square(0, 0.0012, 0.00003)]),
      true,
      60,
      100,
    );
    expect(r.verdict).toBe("clear");
  });
  it("clear with no buildings nearby", () => {
    const r = assessHemfridszon(P, ready([]), true, 60, 100);
    expect(r.verdict).toBe("clear");
    expect(r.headline).toContain("Inga byggnader");
  });
});

describe("assessFire / assessPosition", () => {
  it("fire is always a judgment call", () => {
    expect(assessFire().verdict).toBe("judgment");
  });
  it("returns the four rules in order", () => {
    const rules = assessPosition(P, {
      reserves: ready([]),
      cultivated: ready([]),
      buildings: ready([]),
      positionInView: true,
      buildingNoCampM: 60,
      buildingCautionM: 100,
    });
    expect(rules.map((r) => r.id)).toEqual([
      "reserve",
      "cultivated",
      "hemfridszon",
      "fire",
    ]);
  });
});

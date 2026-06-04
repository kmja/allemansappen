import { describe, expect, it } from "vitest";
import {
  bboxAreaKm2,
  bboxToOverpass,
  formatCheckedAt,
  parseBBox,
  roundCoord,
  timeAgo,
} from "@/lib/geo";
import type { BBox } from "@/lib/types";

describe("roundCoord", () => {
  it("rounds to the requested decimals", () => {
    expect(roundCoord(59.123456)).toBe(59.12346);
    expect(roundCoord(59.123456, 2)).toBe(59.12);
    expect(roundCoord(18.999999, 4)).toBe(19);
  });
});

describe("bboxToOverpass", () => {
  it("emits south,west,north,east in Overpass order", () => {
    const bbox: BBox = [18.0, 59.3, 18.05, 59.35]; // w,s,e,n
    expect(bboxToOverpass(bbox)).toBe("59.3,18,59.35,18.05");
  });
});

describe("parseBBox", () => {
  it("parses a valid west,south,east,north string", () => {
    expect(parseBBox("18.0,59.3,18.05,59.35")).toEqual([18, 59.3, 18.05, 59.35]);
  });
  it("rejects malformed, NaN, inverted and out-of-range boxes", () => {
    expect(parseBBox(null)).toBeNull();
    expect(parseBBox("1,2,3")).toBeNull();
    expect(parseBBox("a,b,c,d")).toBeNull();
    expect(parseBBox("18,59,17,60")).toBeNull(); // west >= east
    expect(parseBBox("18,60,19,59")).toBeNull(); // south >= north
    expect(parseBBox("-181,0,1,1")).toBeNull(); // out of range
  });
});

describe("bboxAreaKm2", () => {
  it("is positive and on the right order of magnitude", () => {
    // ~0.05° lng x 0.05° lat near lat 59 ≈ a few km²
    const area = bboxAreaKm2([18.0, 59.3, 18.05, 59.35]);
    expect(area).toBeGreaterThan(5);
    expect(area).toBeLessThan(30);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-06-04T12:00:00Z");
  it("describes recent times in Swedish", () => {
    expect(timeAgo(new Date(now - 10_000).toISOString(), now)).toBe("nyss");
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe(
      "5 min sedan",
    );
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe(
      "3 h sedan",
    );
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe(
      "2 d sedan",
    );
  });
});

describe("formatCheckedAt", () => {
  it("returns a non-empty string for a valid ISO timestamp", () => {
    const s = formatCheckedAt("2026-06-04T12:00:00Z");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});

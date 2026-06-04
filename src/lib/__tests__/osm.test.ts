import { describe, expect, it } from "vitest";
import {
  buildOverpassQuery,
  osmToGeoJSON,
  type OsmElement,
} from "@/lib/osm";
import type { BBox } from "@/lib/types";
import type { MultiPolygon, Point, Polygon } from "geojson";

const bbox: BBox = [18.0, 59.3, 18.05, 59.35];

describe("buildOverpassQuery", () => {
  it("targets buildings and includes the bbox", () => {
    const q = buildOverpassQuery("buildings", bbox);
    expect(q).toContain('way["building"]');
    expect(q).toContain('relation["building"]');
    expect(q).toContain("59.3,18,59.35,18.05");
    expect(q).toContain("out geom");
  });
  it("targets cultivated land use values", () => {
    const q = buildOverpassQuery("landuse", bbox);
    expect(q).toContain("farmland");
    expect(q).toContain("meadow");
    expect(q).toContain('["landuse"');
  });
  it("targets nature reserves and protected areas", () => {
    const q = buildOverpassQuery("reserves", bbox);
    expect(q).toContain('leisure"="nature_reserve"');
    expect(q).toContain('boundary"="protected_area"');
  });
});

describe("osmToGeoJSON", () => {
  it("converts a node into a Point with tags + osm_id", () => {
    const els: OsmElement[] = [
      { type: "node", id: 1, lat: 59.3, lon: 18.0, tags: { name: "X" } },
    ];
    const [f] = osmToGeoJSON(els);
    expect((f.geometry as Point).type).toBe("Point");
    expect((f.geometry as Point).coordinates).toEqual([18.0, 59.3]);
    expect(f.properties).toMatchObject({ osm_id: "node/1", name: "X" });
  });

  it("converts a closed way into a Polygon, preserving closure", () => {
    const els: OsmElement[] = [
      {
        type: "way",
        id: 2,
        geometry: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 0, lon: 0 },
        ],
      },
    ];
    const [f] = osmToGeoJSON(els);
    const ring = (f.geometry as Polygon).coordinates[0];
    expect((f.geometry as Polygon).type).toBe("Polygon");
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
    expect(ring).toHaveLength(4);
  });

  it("auto-closes an open way ring", () => {
    const els: OsmElement[] = [
      {
        type: "way",
        id: 3,
        geometry: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
        ],
      },
    ];
    const [f] = osmToGeoJSON(els);
    const ring = (f.geometry as Polygon).coordinates[0];
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("drops ways with too few points", () => {
    const els: OsmElement[] = [
      { type: "way", id: 4, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] },
    ];
    expect(osmToGeoJSON(els)).toHaveLength(0);
  });

  it("converts a relation's outer members into a MultiPolygon, skipping inner", () => {
    const els: OsmElement[] = [
      {
        type: "relation",
        id: 5,
        tags: { leisure: "nature_reserve", name: "Reservat" },
        members: [
          {
            type: "way",
            role: "outer",
            geometry: [
              { lat: 0, lon: 0 },
              { lat: 0, lon: 2 },
              { lat: 2, lon: 2 },
              { lat: 0, lon: 0 },
            ],
          },
          {
            type: "way",
            role: "inner",
            geometry: [
              { lat: 0.5, lon: 0.5 },
              { lat: 0.5, lon: 1 },
              { lat: 1, lon: 1 },
            ],
          },
        ],
      },
    ];
    const [f] = osmToGeoJSON(els);
    const geom = f.geometry as MultiPolygon;
    expect(geom.type).toBe("MultiPolygon");
    expect(geom.coordinates).toHaveLength(1); // only the outer
    expect(f.properties).toMatchObject({ osm_id: "relation/5", name: "Reservat" });
  });

  it("returns an empty array for empty / unconvertible input", () => {
    expect(osmToGeoJSON([])).toEqual([]);
    expect(osmToGeoJSON([{ type: "relation", id: 9 }])).toEqual([]);
  });
});

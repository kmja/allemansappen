import { type NextRequest, NextResponse } from "next/server";

import { fetchOverpass } from "@/lib/server/overpass";
import { bboxAreaKm2, parseBBox } from "@/lib/geo";
import type { OverpassKind } from "@/lib/types";

const VALID_KINDS: OverpassKind[] = ["buildings", "landuse", "reserves"];
const MAX_AREA_KM2 = 250;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as OverpassKind | null;
  const bbox = parseBBox(searchParams.get("bbox"));

  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "Ogiltig 'kind'. Förväntade buildings | landuse | reserves." },
      { status: 400 },
    );
  }
  if (!bbox) {
    return NextResponse.json(
      { error: "Ogiltig eller saknad 'bbox' (west,south,east,north)." },
      { status: 400 },
    );
  }
  if (bboxAreaKm2(bbox) > MAX_AREA_KM2) {
    return NextResponse.json(
      { error: "Området är för stort – zooma in." },
      { status: 413 },
    );
  }

  try {
    const data = await fetchOverpass(kind, bbox);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=120, s-maxage=300" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Kunde inte hämta OSM-data.",
      },
      { status: 502 },
    );
  }
}

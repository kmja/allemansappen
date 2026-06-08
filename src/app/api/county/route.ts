import { type NextRequest, NextResponse } from "next/server";

import { detectCounty } from "@/lib/server/county";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Ogiltig lat/lon." }, { status: 400 });
  }
  try {
    const county = await detectCounty(lat, lon);
    return NextResponse.json(
      { county },
      {
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunde inte slå upp län." },
      { status: 502 },
    );
  }
}

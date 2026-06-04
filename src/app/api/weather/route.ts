import { type NextRequest, NextResponse } from "next/server";

import { fetchWeather } from "@/lib/server/smhi";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Ogiltiga koordinater." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchWeather(lat, lon);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=1800" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Kunde inte hämta väder.",
      },
      { status: 502 },
    );
  }
}

import { type NextRequest, NextResponse } from "next/server";

/**
 * Secure proxy for Lantmäteriet property-boundary tiles (WMS GetMap).
 *
 * The MapLibre raster source points at `/api/lm-tiles?bbox={bbox-epsg-3857}`,
 * and this handler substitutes the bbox into a configured WMS template and
 * injects credentials server-side — so the Lantmäteriet secret never reaches
 * the browser.
 *
 * Configure via env (see .env.example):
 *   LANTMATERIET_WMS_TEMPLATE  (use {bbox} where the EPSG:3857 bbox goes)
 *   LANTMATERIET_TOKEN         (bearer)  — or —
 *   LANTMATERIET_USERNAME / LANTMATERIET_PASSWORD  (HTTP basic)
 *
 * When unconfigured it returns 503 so the client can mark the property layer
 * as "needs setup" instead of silently failing.
 */
export async function GET(req: NextRequest) {
  const template = process.env.LANTMATERIET_WMS_TEMPLATE?.trim();
  if (!template) {
    return NextResponse.json(
      { error: "Lantmäteriet är inte konfigurerat." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get("bbox");
  if (!bbox || !/^[-0-9.,eE+]+$/.test(bbox)) {
    return NextResponse.json({ error: "Ogiltig bbox." }, { status: 400 });
  }

  const target = template.replace("{bbox}", encodeURIComponent(bbox));

  const headers: Record<string, string> = {};
  const token = process.env.LANTMATERIET_TOKEN?.trim();
  const user = process.env.LANTMATERIET_USERNAME?.trim();
  const pass = process.env.LANTMATERIET_PASSWORD;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (user && pass != null) {
    headers.Authorization =
      "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  try {
    const upstream = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Lantmäteriet svarade ${upstream.status}.` },
        { status: 502 },
      );
    }
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Kunde inte nå Lantmäteriet.",
      },
      { status: 502 },
    );
  }
}

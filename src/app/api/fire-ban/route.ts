import { type NextRequest, NextResponse } from "next/server";

import { getFireBan } from "@/lib/server/fireban";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const county = searchParams.get("county");
  const data = getFireBan(county);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

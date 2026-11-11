import { NextResponse, connection } from "next/server";
import { getPulse } from "@/lib/server/pulse";
import { errorResponse } from "@/lib/server/respond";

export async function GET() {
  await connection(); // always run at request time, never during the build
  try {
    return NextResponse.json(await getPulse(), { headers: { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=3600" } });
  } catch (e) {
    return errorResponse(e);
  }
}

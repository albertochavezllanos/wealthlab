import { NextResponse, connection } from "next/server";

/** AI web research and multi-ticker loads can take up to a minute. */
export const maxDuration = 120;
import { getPulse } from "@/lib/server/pulse";
import { errorResponse } from "@/lib/server/respond";
import { visitorId } from "@/lib/server/quota";

export async function GET(request: Request) {
  await connection(); // always run at request time, never during the build
  try {
    return NextResponse.json(await getPulse(visitorId(request)), { headers: { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=3600" } });
  } catch (e) {
    return errorResponse(e);
  }
}

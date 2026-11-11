import { NextResponse, connection } from "next/server";
import { getHistory } from "@/lib/server/tiingo";
import { EOD_CACHE, errorResponse } from "@/lib/server/respond";

export async function GET(request: Request) {
  await connection(); // always run at request time, never during the build
  const ticker = new URL(request.url).searchParams.get("ticker") ?? "";
  try {
    const history = await getHistory(ticker);
    return NextResponse.json(history, { headers: { "Cache-Control": EOD_CACHE } });
  } catch (e) {
    return errorResponse(e);
  }
}

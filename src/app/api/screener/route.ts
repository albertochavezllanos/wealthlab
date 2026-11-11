import { NextResponse, connection } from "next/server";
import { batchCacheHeader, loadSnapshots } from "@/lib/server/batch";
import { errorResponse } from "@/lib/server/respond";
import { SCREENER } from "@/lib/universe";

export async function GET() {
  await connection(); // always run at request time, never during the build
  try {
    const result = await loadSnapshots(SCREENER.map((s) => s.ticker));
    return NextResponse.json(result, { headers: { "Cache-Control": batchCacheHeader(result) } });
  } catch (e) {
    return errorResponse(e);
  }
}

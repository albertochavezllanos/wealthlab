import { NextResponse, connection } from "next/server";
import { batchCacheHeader, loadSnapshots } from "@/lib/server/batch";
import { errorResponse } from "@/lib/server/respond";
import { INDEXES, SECTORS } from "@/lib/universe";

export async function GET(request: Request) {
  await connection(); // always run at request time, never during the build
  const group = new URL(request.url).searchParams.get("group") === "sectors" ? SECTORS : INDEXES;
  try {
    const result = await loadSnapshots(group.map((g) => g.ticker));
    // Use our friendly sector names
    for (const r of result.rows) {
      const g = group.find((x) => x.ticker === r.ticker);
      if (g) r.name = g.name;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": batchCacheHeader(result) } });
  } catch (e) {
    return errorResponse(e);
  }
}

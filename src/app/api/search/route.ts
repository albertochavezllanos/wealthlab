import { NextResponse } from "next/server";
import { search } from "@/lib/server/tiingo";
import { errorResponse } from "@/lib/server/respond";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 40) ?? "";
  try {
    const results = await search(q);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

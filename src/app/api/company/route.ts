import { NextResponse, connection } from "next/server";
import { companyReport } from "@/lib/server/company";
import { errorResponse } from "@/lib/server/respond";

export async function GET(request: Request) {
  await connection(); // always run at request time, never during the build
  const ticker = new URL(request.url).searchParams.get("ticker") ?? "";
  try {
    const report = await companyReport(ticker);
    return NextResponse.json(report, {
      headers: { "Cache-Control": report.market ? "public, s-maxage=3600, stale-while-revalidate=21600" : "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

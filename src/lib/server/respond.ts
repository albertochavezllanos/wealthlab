import "server-only";
import { NextResponse } from "next/server";
import { DataError } from "./tiingo";

/** Shared CDN caching header for end-of-day data (shared across all visitors). */
export const EOD_CACHE = "public, s-maxage=21600, stale-while-revalidate=43200";

export function errorResponse(e: unknown) {
  if (e instanceof DataError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong on our side.", code: "upstream" }, { status: 500 });
}

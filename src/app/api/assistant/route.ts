import { NextResponse, connection } from "next/server";
import { ask } from "@/lib/server/assistant";
import { errorResponse } from "@/lib/server/respond";

/**
 * GET so Vercel's CDN can cache identical questions for 12 hours across all visitors:
 * the same question never triggers a second AI call while cached.
 */
export async function GET(request: Request) {
  await connection();
  const question = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 400);
  try {
    const answer = await ask(question);
    const cacheable = !("needTickers" in answer) && !answer.degraded;
    return NextResponse.json(answer, {
      headers: { "Cache-Control": cacheable ? "public, s-maxage=43200, stale-while-revalidate=3600" : "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse, connection } from "next/server";
import { getThemeResearch } from "@/lib/server/pulse";
import { loadSnapshots } from "@/lib/server/batch";
import { errorResponse } from "@/lib/server/respond";
import { THEMES } from "@/lib/themes";

export async function GET(request: Request) {
  await connection(); // always run at request time, never during the build
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const part = new URL(request.url).searchParams.get("part");
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) return NextResponse.json({ error: "Unknown theme." }, { status: 404 });
  try {
    if (part === "market") {
      const m = await loadSnapshots(theme.exposures.map((e) => e.ticker));
      return NextResponse.json(m, { headers: { "Cache-Control": m.pending.length || m.failed.length ? "no-store" : "public, s-maxage=3600" } });
    }
    return NextResponse.json(await getThemeResearch(id), { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    return errorResponse(e);
  }
}

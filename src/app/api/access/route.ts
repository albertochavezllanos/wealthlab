import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

export async function POST(request: Request) {
  const expected = process.env.DEMO_PASSCODE;
  if (!expected) {
    return NextResponse.json(
      { error: "The demo passcode has not been configured on the server yet." },
      { status: 503 },
    );
  }

  let submitted = "";
  try {
    const body = (await request.json()) as { passcode?: unknown };
    submitted = typeof body.passcode === "string" ? body.passcode.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!safeEqual(submitted, expected)) {
    // Small delay to slow down guessing
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "That passcode isn't right. Please try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await accessToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
  return res;
}

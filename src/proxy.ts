import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

/**
 * Demo passcode gate. Every page and API route requires the passcode cookie,
 * except the passcode screen itself and static assets.
 */
export async function proxy(request: NextRequest) {
  const passcode = process.env.DEMO_PASSCODE;
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;

  if (passcode && cookie && safeEqual(cookie, await accessToken(passcode))) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Passcode required." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!access|api/access|_next/static|_next/image|favicon.ico|icon|robots.txt).*)",
  ],
};

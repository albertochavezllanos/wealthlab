/** Demo passcode helpers (shared by the proxy and the /api/access route). */

export const ACCESS_COOKIE = "wl_access";

/** The cookie stores a hash of the passcode, never the passcode itself. */
export async function accessToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`wealthlab-demo:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

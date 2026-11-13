import "server-only";
import { createHash } from "node:crypto";
import { DataError } from "./tiingo";

/**
 * Per-visitor daily limit on NEW AI requests (cache hits never reach this code, so they're free).
 *
 * A visitor is an anonymous hash of IP address + browser, so people sharing an office network
 * still get separate allowances. Counts are kept in Upstash Redis when it's configured
 * (UPSTASH_REDIS_REST_URL / _TOKEN, or Vercel KV's KV_REST_API_URL / _TOKEN), which is exact
 * across all servers; otherwise in this server's memory, which resets when the server restarts.
 * The hourly spend guard in ai.ts stays on as an overall backstop either way.
 */
export const DAILY_AI_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 10);

export function visitorId(request: Request): string {
  const h = request.headers;
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const ua = h.get("user-agent") ?? "";
  return createHash("sha256").update(`wealthlab|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** Calendar day in U.S. Central time, so the limit resets at midnight Central. */
function day() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const memory = new Map<string, number>();

async function bump(key: string, by: 1 | -1): Promise<number> {
  if (redisUrl && redisToken) {
    try {
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([[by === 1 ? "INCR" : "DECR", key], ["EXPIRE", key, 2 * 24 * 3600]]),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const out = (await res.json()) as { result: number }[];
      if (res.ok && typeof out[0]?.result === "number") return out[0].result;
    } catch {
      // fall through to memory if the store is unreachable
    }
  }
  if (memory.size > 20000) memory.clear(); // keep memory bounded
  const n = Math.max(0, (memory.get(key) ?? 0) + by);
  memory.set(key, n);
  return n;
}

const keyFor = (visitor: string) => `ai:${day()}:${visitor}`;

/** Count one new AI request for this visitor, or throw a friendly 429 once they're over today's limit. */
export async function consumeAiRequest(visitor: string): Promise<void> {
  const n = await bump(keyFor(visitor), 1);
  if (n > DAILY_AI_LIMIT) {
    await bump(keyFor(visitor), -1); // don't keep counting blocked attempts
    throw new DataError(
      `You've used today's ${DAILY_AI_LIMIT} new AI requests for this demo. AI answers that are already saved still load, and everything else on the site keeps working. Your allowance resets at midnight Central time.`,
      "daily_limit",
      429,
    );
  }
}

/** Give the request back if the AI call failed on our side. */
export async function refundAiRequest(visitor: string): Promise<void> {
  await bump(keyFor(visitor), -1);
}

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DataError } from "./tiingo";

export const MODEL = "claude-opus-5-5";
/** Server-side refusal fallback (routes a declined request to a suitable model inside the same call). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("PASTE_")) {
    throw new DataError("The AI service hasn't been configured on the server yet.", "not_configured", 503);
  }
  if (!client) client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 120_000 });
  return client;
}

/**
 * Simple cost guard: at most `limit` AI calls per rolling hour per server instance.
 * Cached answers don't count, because they never reach this point.
 */
const calls: number[] = [];
export function spendGuard(limit = 40) {
  const now = Date.now();
  while (calls.length && now - calls[0] > 3600_000) calls.shift();
  if (calls.length >= limit) {
    throw new DataError("The AI features have reached this hour's usage cap for the demo. Please try again later.", "rate_limited", 429);
  }
  calls.push(now);
}

/** Map SDK errors to friendly messages. */
export function aiError(e: unknown): DataError {
  if (e instanceof DataError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new DataError("The AI service key was rejected.", "not_configured", 503);
  if (e instanceof Anthropic.RateLimitError) return new DataError("The AI service is busy. Please try again in a minute.", "rate_limited", 429);
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("credit")) return new DataError("The AI account is out of credits.", "upstream", 502);
    return new DataError("The AI request was rejected.", "upstream", 502);
  }
  if (e instanceof Anthropic.APIError) return new DataError(`The AI service returned an error (${e.status ?? "network"}).`, "upstream", 502);
  return new DataError("The AI service couldn't be reached.", "upstream", 502);
}

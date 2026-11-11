import "server-only";
import { DataError, getHistory } from "./tiingo";
import { snapshot, type Snapshot } from "@/lib/metrics";

export interface BatchResult {
  rows: Snapshot[];
  /** Tickers not loaded because the free data plan's hourly limit was reached */
  pending: string[];
  /** Tickers the provider doesn't support or returned errors for */
  failed: { ticker: string; error: string }[];
  rateLimited: boolean;
}

/**
 * Load snapshots for many tickers with small concurrency. Already-cached tickers cost nothing.
 * Once the provider says we're rate-limited, stop requesting and report the rest as pending.
 */
export async function loadSnapshots(tickers: string[], concurrency = 4): Promise<BatchResult> {
  const rows: Snapshot[] = [];
  const pending: string[] = [];
  const failed: { ticker: string; error: string }[] = [];
  let rateLimited = false;
  let i = 0;

  async function worker() {
    while (i < tickers.length) {
      const t = tickers[i++];
      if (rateLimited) {
        pending.push(t);
        continue;
      }
      try {
        rows.push(snapshot(await getHistory(t)));
      } catch (e) {
        if (e instanceof DataError && e.code === "rate_limited") {
          rateLimited = true;
          pending.push(t);
        } else {
          failed.push({ ticker: t, error: e instanceof Error ? e.message : "Unavailable" });
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const order = new Map(tickers.map((t, k) => [t, k]));
  rows.sort((a, b) => order.get(a.ticker)! - order.get(b.ticker)!);
  return { rows, pending, failed, rateLimited };
}

/** Cache header: long CDN caching only when everything loaded. */
export function batchCacheHeader(r: BatchResult) {
  return r.pending.length || r.failed.length ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=21600";
}

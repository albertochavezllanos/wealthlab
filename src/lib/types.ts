/** Types shared by server routes and browser code. */

export type AssetType = "Stock" | "ETF" | "Mutual Fund" | "Crypto";

export interface SearchResult {
  ticker: string; // canonical upper-case ticker, e.g. "AAPL", "BTCUSD"
  name: string;
  assetType: AssetType;
  exchange?: string;
}

/**
 * One trading day. Compact tuple to keep payloads small:
 * [date (YYYY-MM-DD), raw close, total-return adjusted close, dividend cash per share (on ex-date), split factor (on split date, else 1)]
 */
export type PriceRow = [string, number, number, number, number];

export interface PriceHistory {
  ticker: string;
  name: string;
  assetType: AssetType;
  /** Data provenance shown on screen */
  source: string;
  /** ISO timestamp of when the server fetched this data from the provider */
  fetchedAt: string;
  firstDate: string;
  lastDate: string;
  rows: PriceRow[];
}

export interface ApiError {
  error: string;
  code?: "not_found" | "rate_limited" | "bad_request" | "upstream" | "not_configured";
}

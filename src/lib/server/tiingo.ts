import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { memo, stale } from "./memo";
import { KNOWN } from "@/lib/universe";
import type { AssetType, PriceHistory, PriceRow, SearchResult } from "@/lib/types";

const BASE = "https://api.tiingo.com";
const HISTORY_TTL = 8 * 60 * 60 * 1000; // end-of-day data changes once a day
const SEARCH_TTL = 24 * 60 * 60 * 1000;

export class DataError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "rate_limited" | "bad_request" | "upstream" | "not_configured" | "daily_limit",
    public status: number,
  ) {
    super(message);
  }
}

/** Major crypto assets Tiingo supports (its search endpoint does not list crypto). */
export const CRYPTO: SearchResult[] = [
  { ticker: "BTCUSD", name: "Bitcoin (USD)", assetType: "Crypto" },
  { ticker: "ETHUSD", name: "Ethereum (USD)", assetType: "Crypto" },
  { ticker: "SOLUSD", name: "Solana (USD)", assetType: "Crypto" },
  { ticker: "XRPUSD", name: "XRP (USD)", assetType: "Crypto" },
  { ticker: "ADAUSD", name: "Cardano (USD)", assetType: "Crypto" },
  { ticker: "DOGEUSD", name: "Dogecoin (USD)", assetType: "Crypto" },
  { ticker: "LTCUSD", name: "Litecoin (USD)", assetType: "Crypto" },
];
const CRYPTO_SET = new Set(CRYPTO.map((c) => c.ticker));

export function isValidTicker(t: string) {
  return /^[A-Za-z0-9.\-]{1,15}$/.test(t);
}

function token() {
  const t = process.env.TIINGO_API_KEY;
  if (!t || t.startsWith("PASTE_")) {
    throw new DataError("The market data key has not been configured on the server.", "not_configured", 503);
  }
  return t;
}

async function tiingo<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", Authorization: `Token ${token()}` },
      cache: "no-store", // we cache ourselves
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    if (e instanceof DataError) throw e;
    throw new DataError("Couldn't reach the market data provider. Please try again shortly.", "upstream", 502);
  }
  const text = await res.text();
  if (res.status === 429 || /run over your (hourly|daily)|request allocation/i.test(text)) {
    throw new DataError(
      "The free market data plan's hourly request limit has been reached. Please try again in a few minutes. Previously loaded investments still work.",
      "rate_limited",
      429,
    );
  }
  if (res.status === 404) throw new DataError("That ticker isn't supported by our data provider.", "not_found", 404);
  if (!res.ok) throw new DataError(`The market data provider returned an error (${res.status}).`, "upstream", 502);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new DataError("The market data provider returned an unreadable response.", "upstream", 502);
  }
}

interface TiingoSearchHit {
  ticker: string;
  name: string;
  assetType: string;
  isActive: boolean;
  countryCode: string;
}

function normType(t: string): AssetType | null {
  if (t === "Stock") return "Stock";
  if (t === "ETF") return "ETF";
  if (t === "Mutual Fund") return "Mutual Fund";
  return null;
}

/** Instant, free matches from our built-in list of well-known investments (no data request used). */
function localMatches(lower: string): SearchResult[] {
  const all: SearchResult[] = [
    ...CRYPTO,
    ...Object.values(KNOWN).map((k) => ({ ticker: k.ticker, name: k.name, assetType: k.assetType })),
  ];
  const seen = new Set<string>();
  const scored: { r: SearchResult; score: number }[] = [];
  for (const r of all) {
    if (seen.has(r.ticker)) continue;
    const t = r.ticker.toLowerCase();
    const n = r.name.toLowerCase();
    let score = 0;
    if (t === lower) score = 100;
    else if (t.startsWith(lower)) score = 80 - t.length;
    else if (n.startsWith(lower)) score = 60;
    else if (n.split(/[\s(&.,-]+/).some((w) => w.startsWith(lower))) score = 40;
    if (score > 0) {
      seen.add(r.ticker);
      scored.push({ r, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.r);
}

export async function search(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const local = localMatches(lower);
  // Well-known names are answered locally; only unusual searches use the data provider.
  if (local.length >= 1) return local.slice(0, 10);

  let hits: TiingoSearchHit[] = [];
  try {
    hits = await memo(`search:${lower}`, SEARCH_TTL, () =>
      tiingo<TiingoSearchHit[]>(`/tiingo/utilities/search?query=${encodeURIComponent(q)}&limit=15`),
    );
  } catch (e) {
    if (e instanceof DataError && e.code === "rate_limited") {
      throw new DataError(
        "Searching for less-common names is paused for a few minutes (free data plan limit). Well-known companies and funds still work, or type an exact ticker and press Enter.",
        "rate_limited",
        429,
      );
    }
    throw e;
  }
  const results: SearchResult[] = [];
  for (const h of hits) {
    const type = normType(h.assetType);
    if (!type || !h.isActive || (h.countryCode && h.countryCode !== "US")) continue;
    results.push({ ticker: h.ticker.toUpperCase(), name: titleCase(h.name), assetType: type });
  }
  return results.slice(0, 10);
}

/** Tiingo names are often ALL CAPS; make them readable. */
function titleCase(name: string) {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Etf|Spdr|Ii|Iii|Usa|Us|Msci|S&p)\b/g, (m) => m.toUpperCase());
}

/** Resolve a ticker's display name and asset type (cached). */
async function describe(ticker: string): Promise<SearchResult> {
  if (CRYPTO_SET.has(ticker)) return CRYPTO.find((c) => c.ticker === ticker)!;
  const known = KNOWN[ticker];
  if (known) return { ticker, name: known.name, assetType: known.assetType }; // no request needed
  const hits = await memo(`search:${ticker.toLowerCase()}`, SEARCH_TTL, () =>
    tiingo<TiingoSearchHit[]>(`/tiingo/utilities/search?query=${encodeURIComponent(ticker)}&limit=15`),
  );
  const exact = hits.find((h) => h.ticker.toUpperCase() === ticker && normType(h.assetType));
  if (!exact) throw new DataError(`"${ticker}" isn't a supported stock, ETF, fund, or crypto in our data.`, "not_found", 404);
  return { ticker, name: titleCase(exact.name), assetType: normType(exact.assetType)! };
}

interface TiingoDaily {
  date: string;
  close: number;
  adjClose: number;
  divCash: number;
  splitFactor: number;
}
interface TiingoCrypto {
  ticker: string;
  priceData: { date: string; close: number }[];
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/** Full end-of-day history for one ticker (cached 6 hours). */
export async function getHistory(rawTicker: string): Promise<PriceHistory> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!isValidTicker(ticker)) throw new DataError("That doesn't look like a valid ticker.", "bad_request", 400);
  const key = `history:${ticker}`;
  try {
    return await memo(key, HISTORY_TTL, () => sharedHistory(ticker));
  } catch (e) {
    // If rate-limited, serve an older cached copy rather than fail
    const old = stale<PriceHistory>(key);
    if (old && e instanceof DataError && e.code === "rate_limited") return old;
    throw e;
  }
}

/**
 * Saved end-of-day snapshots shipped with the site (data/eod/<TICKER>.json, made by scripts/snapshot.ts).
 * They keep the demo working even when the free data plan's hourly limit is reached.
 */
function readSnapshot(ticker: string): PriceHistory | null {
  try {
    const file = path.join(process.cwd(), "data", "eod", `${ticker}.json`);
    return JSON.parse(readFileSync(file, "utf8")) as PriceHistory;
  } catch {
    return null;
  }
}

/** The most recent U.S. market close that should exist right now (weekdays; ~6 p.m. ET publish time). */
function expectedLatestClose(now = new Date()): string {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = new Date(Date.UTC(et.getFullYear(), et.getMonth(), et.getDate()));
  if (et.getHours() < 18) d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Use the saved snapshot when it's current; otherwise ask the provider, and fall back to the
 * snapshot (with its real date shown) if the provider is busy or rate-limited.
 */
async function sharedHistory(ticker: string): Promise<PriceHistory> {
  const snap = readSnapshot(ticker);
  if (snap) {
    const current =
      snap.assetType === "Crypto"
        ? Date.now() - Date.parse(snap.fetchedAt) < 24 * 3600 * 1000
        : snap.lastDate >= expectedLatestClose();
    if (current) return snap;
  }
  try {
    return await loadHistory(ticker);
  } catch (e) {
    if (snap && e instanceof DataError && (e.code === "rate_limited" || e.code === "upstream")) return snap;
    throw e;
  }
}

async function loadHistory(ticker: string): Promise<PriceHistory> {
  const info = await describe(ticker);
  let rows: PriceRow[];

  if (info.assetType === "Crypto") {
    const data = await tiingo<TiingoCrypto[]>(
      `/tiingo/crypto/prices?tickers=${ticker.toLowerCase()}&startDate=2014-01-01&resampleFreq=1day`,
    );
    const pd = data[0]?.priceData ?? [];
    rows = pd.filter((p) => p.close > 0).map((p) => [p.date.slice(0, 10), round(p.close), round(p.close), 0, 1]);
  } else {
    const data = await tiingo<TiingoDaily[]>(
      `/tiingo/daily/${encodeURIComponent(ticker)}/prices?startDate=1990-01-01`,
    );
    rows = data
      .filter((d) => d.close > 0)
      .map((d) => [d.date.slice(0, 10), round(d.close), round(d.adjClose), round(d.divCash || 0), d.splitFactor || 1]);
  }

  if (rows.length === 0) {
    throw new DataError(`No price history is available for ${ticker}.`, "not_found", 404);
  }

  return {
    ticker,
    name: info.name,
    assetType: info.assetType,
    source:
      info.assetType === "Crypto"
        ? "Tiingo crypto, daily close (UTC day)"
        : "Tiingo end-of-day (official close)",
    fetchedAt: new Date().toISOString(),
    firstDate: rows[0][0],
    lastDate: rows[rows.length - 1][0],
    rows,
  };
}

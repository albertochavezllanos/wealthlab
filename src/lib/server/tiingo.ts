import "server-only";
import { memo, stale } from "./memo";
import type { AssetType, PriceHistory, PriceRow, SearchResult } from "@/lib/types";

const BASE = "https://api.tiingo.com";
const HISTORY_TTL = 6 * 60 * 60 * 1000; // end-of-day data: 6 hours is plenty
const SEARCH_TTL = 24 * 60 * 60 * 1000;

export class DataError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "rate_limited" | "bad_request" | "upstream" | "not_configured",
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

export async function search(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const cryptoHits = CRYPTO.filter(
    (c) => c.ticker.toLowerCase().startsWith(lower) || c.name.toLowerCase().includes(lower),
  );

  const hits = await memo(`search:${lower}`, SEARCH_TTL, () =>
    tiingo<TiingoSearchHit[]>(`/tiingo/utilities/search?query=${encodeURIComponent(q)}&limit=15`),
  );
  const results: SearchResult[] = [];
  for (const h of hits) {
    const type = normType(h.assetType);
    if (!type || !h.isActive || (h.countryCode && h.countryCode !== "US")) continue;
    results.push({ ticker: h.ticker.toUpperCase(), name: titleCase(h.name), assetType: type });
  }
  return [...cryptoHits, ...results].slice(0, 10);
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
    return await memo(key, HISTORY_TTL, () => loadHistory(ticker));
  } catch (e) {
    // If rate-limited, serve an older cached copy rather than fail
    const old = stale<PriceHistory>(key);
    if (old && e instanceof DataError && e.code === "rate_limited") return old;
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

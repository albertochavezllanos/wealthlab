import "server-only";
import { memo } from "./memo";
import { DataError } from "./tiingo";

/**
 * SEC EDGAR (free, no key). The SEC asks every automated client to identify itself with a
 * contact email in the User-Agent header and to stay under 10 requests per second.
 */
function headers() {
  const email = process.env.SEC_CONTACT_EMAIL;
  if (!email || email.startsWith("PASTE_")) {
    throw new DataError("The SEC contact email has not been configured on the server.", "not_configured", 503);
  }
  return { "User-Agent": `WealthLab educational prototype ${email}`, Accept: "application/json" };
}

async function secJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch (e) {
    if (e instanceof DataError) throw e;
    throw new DataError("Couldn't reach SEC EDGAR. Please try again shortly.", "upstream", 502);
  }
  if (res.status === 404) throw new DataError("SEC EDGAR has no financial data for this company.", "not_found", 404);
  if (res.status === 429 || res.status === 403) throw new DataError("SEC EDGAR is limiting requests right now. Please try again in a minute.", "rate_limited", 429);
  if (!res.ok) throw new DataError(`SEC EDGAR returned an error (${res.status}).`, "upstream", 502);
  return (await res.json()) as T;
}

// ---------- Ticker -> CIK ----------

interface TickerEntry { cik_str: number; ticker: string; title: string }

async function tickerTable(): Promise<Record<string, { cik: number; title: string }>> {
  const raw = await secJson<Record<string, TickerEntry>>("https://www.sec.gov/files/company_tickers.json");
  const out: Record<string, { cik: number; title: string }> = {};
  for (const v of Object.values(raw)) out[v.ticker.toUpperCase()] = { cik: v.cik_str, title: v.title };
  return out;
}

export async function lookupCik(ticker: string) {
  const table = await memo("sec:tickers", 24 * 3600 * 1000, tickerTable);
  return table[ticker.toUpperCase()] ?? null;
}

/** Company names keyed by ticker, for matching names in questions. */
export async function secTitles() {
  return memo("sec:tickers", 24 * 3600 * 1000, tickerTable);
}

// ---------- Company facts -> annual summary ----------

interface Fact { start?: string; end: string; val: number; accn: string; fy: number; fp: string; form: string; filed: string }
interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { label: string; units: Record<string, Fact[]> }>>;
}

export interface SourceRef { form: string; filed: string; accn: string; url: string }
export interface FYRow {
  end: string; // fiscal year end date
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  cash: number | null;
  debt: number | null;
  equity: number | null;
  source: SourceRef | null; // the 10-K that reported this year's revenue/net income
}
export interface CompanySummary {
  cik: number;
  name: string;
  ticker: string;
  years: FYRow[]; // oldest -> newest, up to 5
  sharesOutstanding: { value: number; date: string; source: SourceRef } | null;
  filingsUrl: string;
  fetchedAt: string;
  notes: string[];
}

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F"]);
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5;

function filingUrl(cik: number, accn: string) {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/${accn}-index.htm`;
}

/** Annual values for one concept: { end -> fact }, latest filing wins (captures restatements). */
function annual(cf: CompanyFacts, names: string[], unit = "USD", instant = false): Map<string, Fact> {
  const best = new Map<string, Fact>();
  const gaap = cf.facts["us-gaap"] ?? {};
  // Prefer the concept with the most recent data, then fill older years from the others
  const candidates = names
    .map((n) => (gaap[n]?.units?.[unit] ?? []).filter((f) => ANNUAL_FORMS.has(f.form) && (instant ? !f.start : f.start && days(f.start, f.end) > 340 && days(f.start, f.end) < 390)))
    .filter((l) => l.length)
    .sort((a, b) => Math.max(...b.map((f) => Date.parse(f.end))) - Math.max(...a.map((f) => Date.parse(f.end))));
  for (const list of candidates) {
    const local = new Map<string, Fact>();
    for (const f of list) {
      const cur = local.get(f.end);
      if (!cur || f.filed > cur.filed) local.set(f.end, f);
    }
    for (const [end, f] of local) if (!best.has(end)) best.set(end, f);
  }
  return best;
}

async function companyFacts(cik: number): Promise<CompanyFacts> {
  return secJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`);
}

async function summarizeCompany(ticker: string): Promise<CompanySummary> {
  const hit = await lookupCik(ticker);
  if (!hit) throw new DataError(`${ticker} isn't an SEC-registered operating company (funds and crypto don't file company financials).`, "not_found", 404);
  const cf = await companyFacts(hit.cik);

  const revenue = annual(cf, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax", "RevenuesNetOfInterestExpense"]);
  const gross = annual(cf, ["GrossProfit"]);
  const opInc = annual(cf, ["OperatingIncomeLoss"]);
  const net = annual(cf, ["NetIncomeLoss", "ProfitLoss"]);
  const eps = annual(cf, ["EarningsPerShareDiluted"], "USD/shares");
  const ocf = annual(cf, ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]);
  const capex = annual(cf, ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"]);
  const cash = annual(cf, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"], "USD", true);
  const ltd = annual(cf, ["LongTermDebt"], "USD", true);
  const ltdNon = annual(cf, ["LongTermDebtNoncurrent"], "USD", true);
  const ltdCur = annual(cf, ["LongTermDebtCurrent"], "USD", true);
  const equity = annual(cf, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "USD", true);

  // Fiscal year ends come from revenue (or net income when revenue isn't tagged, e.g. some banks)
  const backbone = revenue.size >= net.size ? revenue : net;
  const ends = [...backbone.keys()].sort().slice(-5);
  const v = (m: Map<string, Fact>, end: string) => m.get(end)?.val ?? null;

  const years: FYRow[] = ends.map((end) => {
    const debtVal = v(ltd, end) ?? (v(ltdNon, end) !== null ? (v(ltdNon, end) ?? 0) + (v(ltdCur, end) ?? 0) : null);
    const o = v(ocf, end), c = v(capex, end);
    const src = backbone.get(end)!;
    return {
      end,
      revenue: v(revenue, end),
      grossProfit: v(gross, end),
      operatingIncome: v(opInc, end),
      netIncome: v(net, end),
      epsDiluted: v(eps, end),
      operatingCashFlow: o,
      capex: c,
      freeCashFlow: o !== null && c !== null ? o - c : null,
      cash: v(cash, end),
      debt: debtVal,
      equity: v(equity, end),
      source: { form: src.form, filed: src.filed, accn: src.accn, url: filingUrl(hit.cik, src.accn) },
    };
  });

  // Shares outstanding: most recent cover-page figure
  const sharesFacts = cf.facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  const latestShares = [...sharesFacts].sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : a.filed < b.filed ? 1 : -1))[0];

  const notes: string[] = [];
  if (years.length === 0) notes.push("No annual financial statements in standard XBRL tags were found for this company.");
  if (years.some((y) => y.revenue === null)) notes.push("Revenue isn't reported under a standard tag for some years (common for banks and insurers).");
  if (years.some((y) => y.debt === null)) notes.push("Long-term debt isn't reported under a standard tag for some years.");
  if (years.some((y) => y.grossProfit === null)) notes.push("Gross profit isn't reported (many service companies and banks don't report it).");

  return {
    cik: hit.cik,
    name: cf.entityName || hit.title,
    ticker: ticker.toUpperCase(),
    years,
    sharesOutstanding: latestShares
      ? { value: latestShares.val, date: latestShares.end, source: { form: latestShares.form, filed: latestShares.filed, accn: latestShares.accn, url: filingUrl(hit.cik, latestShares.accn) } }
      : null,
    filingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${hit.cik}&type=10-K&dateb=&owner=include&count=40`,
    fetchedAt: new Date().toISOString(),
    notes,
  };
}

export async function getCompany(ticker: string): Promise<CompanySummary> {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(t)) throw new DataError("That doesn't look like a valid ticker.", "bad_request", 400);
  return memo(`sec:company:${t}`, 12 * 3600 * 1000, () => summarizeCompany(t));
}

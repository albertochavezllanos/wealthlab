import "server-only";
import { getCompany, type CompanySummary } from "./sec";
import { getHistory } from "./tiingo";
import { snapshot, type Snapshot } from "@/lib/metrics";

export interface Valuation {
  price: number;
  priceDate: string;
  marketCap: number | null;
  pe: number | null; // price / latest fiscal-year diluted EPS
  ps: number | null; // market cap / latest fiscal-year revenue
  fcfYield: number | null; // latest fiscal-year free cash flow / market cap
  basisYear: string | null; // fiscal year end used
  sharesDate: string | null;
}

export interface CompanyReport {
  company: CompanySummary;
  market: Snapshot | null;
  marketError: string | null;
  valuation: Valuation | null;
}

export async function companyReport(ticker: string): Promise<CompanyReport> {
  const company = await getCompany(ticker);
  let market: Snapshot | null = null;
  let marketError: string | null = null;
  try {
    market = snapshot(await getHistory(ticker));
  } catch (e) {
    marketError = e instanceof Error ? e.message : "Price data unavailable.";
  }
  let valuation: Valuation | null = null;
  if (market) {
    const y = company.years.at(-1) ?? null;
    const shares = company.sharesOutstanding?.value ?? null;
    const mcap = shares ? shares * market.close : null;
    valuation = {
      price: market.close,
      priceDate: market.date,
      marketCap: mcap,
      pe: y?.epsDiluted && y.epsDiluted > 0 ? market.close / y.epsDiluted : null,
      ps: mcap && y?.revenue ? mcap / y.revenue : null,
      fcfYield: mcap && y?.freeCashFlow !== null && y?.freeCashFlow !== undefined ? y.freeCashFlow / mcap : null,
      basisYear: y?.end ?? null,
      sharesDate: company.sharesOutstanding?.date ?? null,
    };
  }
  return { company, market, marketError, valuation };
}

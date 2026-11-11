/**
 * Curated ticker lists (names are fixed so the server doesn't spend data requests looking them up).
 * Client-safe: no secrets here.
 */
import type { AssetType } from "./types";

export interface Known {
  ticker: string;
  name: string;
  assetType: AssetType;
  sector?: string;
}

export const INDEXES: Known[] = [
  { ticker: "SPY", name: "S&P 500 (SPDR S&P 500 ETF)", assetType: "ETF" },
  { ticker: "QQQ", name: "Nasdaq-100 (Invesco QQQ)", assetType: "ETF" },
  { ticker: "DIA", name: "Dow Jones Industrial Average (SPDR DIA)", assetType: "ETF" },
  { ticker: "IWM", name: "Russell 2000 small caps (iShares IWM)", assetType: "ETF" },
];

export const SECTORS: Known[] = [
  { ticker: "XLK", name: "Technology", assetType: "ETF" },
  { ticker: "XLC", name: "Communication Services", assetType: "ETF" },
  { ticker: "XLY", name: "Consumer Discretionary", assetType: "ETF" },
  { ticker: "XLP", name: "Consumer Staples", assetType: "ETF" },
  { ticker: "XLV", name: "Health Care", assetType: "ETF" },
  { ticker: "XLF", name: "Financials", assetType: "ETF" },
  { ticker: "XLI", name: "Industrials", assetType: "ETF" },
  { ticker: "XLE", name: "Energy", assetType: "ETF" },
  { ticker: "XLU", name: "Utilities", assetType: "ETF" },
  { ticker: "XLB", name: "Materials", assetType: "ETF" },
  { ticker: "XLRE", name: "Real Estate", assetType: "ETF" },
];

const s = (ticker: string, name: string, sector: string): Known => ({ ticker, name, assetType: "Stock", sector });
const e = (ticker: string, name: string, sector: string): Known => ({ ticker, name, assetType: "ETF", sector });

/** About 60 well-known U.S. stocks and ETFs for the screener. */
export const SCREENER: Known[] = [
  s("AAPL", "Apple", "Technology"), s("MSFT", "Microsoft", "Technology"), s("NVDA", "NVIDIA", "Technology"),
  s("AVGO", "Broadcom", "Technology"), s("ORCL", "Oracle", "Technology"), s("CRM", "Salesforce", "Technology"),
  s("ADBE", "Adobe", "Technology"), s("AMD", "Advanced Micro Devices", "Technology"), s("INTC", "Intel", "Technology"),
  s("CSCO", "Cisco Systems", "Technology"), s("IBM", "IBM", "Technology"), s("QCOM", "Qualcomm", "Technology"),
  s("GOOGL", "Alphabet (Google)", "Communication"), s("META", "Meta Platforms", "Communication"),
  s("NFLX", "Netflix", "Communication"), s("DIS", "Walt Disney", "Communication"),
  s("AMZN", "Amazon", "Consumer"), s("TSLA", "Tesla", "Consumer"), s("HD", "Home Depot", "Consumer"),
  s("MCD", "McDonald's", "Consumer"), s("NKE", "Nike", "Consumer"), s("SBUX", "Starbucks", "Consumer"),
  s("WMT", "Walmart", "Staples"), s("COST", "Costco", "Staples"), s("KO", "Coca-Cola", "Staples"),
  s("PEP", "PepsiCo", "Staples"), s("PG", "Procter & Gamble", "Staples"),
  s("JPM", "JPMorgan Chase", "Financials"), s("BAC", "Bank of America", "Financials"), s("WFC", "Wells Fargo", "Financials"),
  s("GS", "Goldman Sachs", "Financials"), s("MS", "Morgan Stanley", "Financials"), s("V", "Visa", "Financials"),
  s("MA", "Mastercard", "Financials"), s("BRK-B", "Berkshire Hathaway (B)", "Financials"), s("BLK", "BlackRock", "Financials"),
  s("UNH", "UnitedHealth Group", "Health Care"), s("JNJ", "Johnson & Johnson", "Health Care"), s("LLY", "Eli Lilly", "Health Care"),
  s("PFE", "Pfizer", "Health Care"), s("MRK", "Merck", "Health Care"), s("ABBV", "AbbVie", "Health Care"),
  s("ISRG", "Intuitive Surgical", "Health Care"),
  s("CAT", "Caterpillar", "Industrials"), s("GE", "GE Aerospace", "Industrials"), s("HON", "Honeywell", "Industrials"),
  s("UPS", "UPS", "Industrials"), s("BA", "Boeing", "Industrials"), s("DE", "Deere & Co.", "Industrials"),
  s("XOM", "Exxon Mobil", "Energy"), s("CVX", "Chevron", "Energy"),
  s("NEE", "NextEra Energy", "Utilities"), s("DUK", "Duke Energy", "Utilities"),
  s("LIN", "Linde", "Materials"), s("PLD", "Prologis", "Real Estate"),
  e("SPY", "S&P 500 ETF", "Broad market"), e("QQQ", "Nasdaq-100 ETF", "Broad market"), e("VTI", "Vanguard Total Stock Market", "Broad market"),
  e("BND", "Vanguard Total Bond Market", "Bonds"), e("VXUS", "Vanguard Total International", "International"),
];

/** Extra names used by the Time Machine replays and Themes (so they never need a lookup request). */
const EXTRA: Known[] = [
  { ticker: "SMH", name: "VanEck Semiconductor ETF", assetType: "ETF" },
  { ticker: "ICLN", name: "iShares Global Clean Energy ETF", assetType: "ETF" },
  { ticker: "PHO", name: "Invesco Water Resources ETF", assetType: "ETF" },
  { ticker: "XBI", name: "SPDR S&P Biotech ETF", assetType: "ETF" },
  { ticker: "CIBR", name: "First Trust NASDAQ Cybersecurity ETF", assetType: "ETF" },
  { ticker: "ETN", name: "Eaton", assetType: "Stock" },
  { ticker: "AWK", name: "American Water Works", assetType: "Stock" },
  { ticker: "XYL", name: "Xylem", assetType: "Stock" },
  { ticker: "PANW", name: "Palo Alto Networks", assetType: "Stock" },
  { ticker: "CRWD", name: "CrowdStrike", assetType: "Stock" },
  // Popular funds and stocks people often type
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetType: "ETF" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", assetType: "ETF" },
  { ticker: "VFIAX", name: "Vanguard 500 Index Fund Admiral Shares", assetType: "Mutual Fund" },
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", assetType: "ETF" },
  { ticker: "GLD", name: "SPDR Gold Shares", assetType: "ETF" },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetType: "ETF" },
  { ticker: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", assetType: "ETF" },
  { ticker: "PLTR", name: "Palantir Technologies", assetType: "Stock" },
  { ticker: "TSM", name: "Taiwan Semiconductor (ADR)", assetType: "Stock" },
  { ticker: "UBER", name: "Uber Technologies", assetType: "Stock" },
];

const ALL: Known[] = [...INDEXES, ...SECTORS, ...SCREENER, ...EXTRA];
export const KNOWN: Record<string, Known> = Object.fromEntries(ALL.map((k) => [k.ticker, k]));

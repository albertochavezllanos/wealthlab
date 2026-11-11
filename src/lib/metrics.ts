/**
 * Price-series utilities and risk metrics computed from real history.
 * Pure functions, no network.
 */
import type { PriceHistory, PriceRow } from "./types";

/**
 * Split-adjusted closing prices: raw closes divided by all splits that happened AFTER each date,
 * so the whole series is on today's share basis (no artificial drops on split days).
 * Dividends are NOT added back (this is the price chart, not total return).
 */
export function splitAdjustedCloses(rows: PriceRow[]): number[] {
  const out = new Array<number>(rows.length);
  let factor = 1;
  for (let i = rows.length - 1; i >= 0; i--) {
    out[i] = rows[i][1] / factor;
    const split = rows[i][4];
    if (split && split !== 1) factor *= split;
  }
  return out;
}

/** Dividends per share restated on today's share basis (divided by later splits). */
export function splitAdjustedDividends(rows: PriceRow[]): number[] {
  const out = new Array<number>(rows.length);
  let factor = 1;
  for (let i = rows.length - 1; i >= 0; i--) {
    out[i] = rows[i][3] / factor;
    const split = rows[i][4];
    if (split && split !== 1) factor *= split;
  }
  return out;
}

export type RangeKey = "1M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "MAX";
export const RANGES: RangeKey[] = ["1M", "6M", "YTD", "1Y", "5Y", "10Y", "MAX"];

export function rangeStart(lastDate: string, range: RangeKey): string {
  const d = new Date(lastDate + "T00:00:00Z");
  switch (range) {
    case "1M": d.setUTCMonth(d.getUTCMonth() - 1); break;
    case "6M": d.setUTCMonth(d.getUTCMonth() - 6); break;
    case "YTD": return `${d.getUTCFullYear()}-01-01`;
    case "1Y": d.setUTCFullYear(d.getUTCFullYear() - 1); break;
    case "3Y": d.setUTCFullYear(d.getUTCFullYear() - 3); break;
    case "5Y": d.setUTCFullYear(d.getUTCFullYear() - 5); break;
    case "10Y": d.setUTCFullYear(d.getUTCFullYear() - 10); break;
    case "MAX": return "0000-01-01";
  }
  return d.toISOString().slice(0, 10);
}

/** Index of the first row on/after a date (binary search). */
export function indexOnOrAfter(rows: PriceRow[], date: string): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] < date) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Index of the last row on/before a date, or -1. */
export function indexOnOrBefore(rows: PriceRow[], date: string): number {
  return indexOnOrAfter(rows, date.slice(0, 10) + "￿") - 1;
}

export function periodsPerYear(h: Pick<PriceHistory, "assetType">) {
  return h.assetType === "Crypto" ? 365 : 252;
}

export function simpleReturns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] > 0) r.push(values[i] / values[i - 1] - 1);
  return r;
}

function mean(a: number[]) {
  return a.reduce((s, x) => s + x, 0) / (a.length || 1);
}
function stdev(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/** Annualized volatility (standard deviation of periodic returns x sqrt(periods per year)). */
export function annualizedVolatility(values: number[], perYear = 252): number {
  return stdev(simpleReturns(values)) * Math.sqrt(perYear);
}

export interface Drawdown {
  pct: number; // negative number, e.g. -0.34 for -34%
  peakIndex: number;
  troughIndex: number;
  recoveryIndex: number | null;
}

/** Largest peak-to-trough fall. */
export function maxDrawdown(values: number[]): Drawdown {
  let peak = values[0] ?? 0, peakI = 0;
  let best: Drawdown = { pct: 0, peakIndex: 0, troughIndex: 0, recoveryIndex: null };
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) { peak = values[i]; peakI = i; }
    const dd = peak > 0 ? values[i] / peak - 1 : 0;
    if (dd < best.pct) best = { pct: dd, peakIndex: peakI, troughIndex: i, recoveryIndex: null };
  }
  if (best.pct < 0) {
    const peakVal = values[best.peakIndex];
    for (let i = best.troughIndex + 1; i < values.length; i++) {
      if (values[i] >= peakVal) { best.recoveryIndex = i; break; }
    }
  }
  return best;
}

/** Compound annual growth rate between two values over a number of years. */
export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

export function yearsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / (365.25 * 24 * 3600 * 1000);
}

/** Pearson correlation of two equal-length return arrays. */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : NaN;
}

/**
 * Align several histories on the dates they ALL traded (intersection), from `startDate`.
 * Returns dates and, per history, total-return (adjusted close) values on those dates.
 */
export function alignTotalReturn(histories: PriceHistory[], startDate: string) {
  if (histories.length === 0) return { dates: [] as string[], series: [] as number[][] };
  const maps = histories.map((h) => {
    const m = new Map<string, number>();
    for (const r of h.rows) if (r[0] >= startDate) m.set(r[0], r[2]);
    return m;
  });
  const dates = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  return { dates, series: maps.map((m) => dates.map((d) => m.get(d)!)) };
}

/** Herfindahl concentration of weights (0..1) and the "effective number" of holdings. */
export function concentration(weights: number[]) {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const hhi = weights.reduce((s, w) => s + (w / total) ** 2, 0);
  return { hhi, effectiveHoldings: hhi > 0 ? 1 / hhi : 0, largest: Math.max(0, ...weights.map((w) => w / total)) };
}

/**
 * Backtest a fixed-weight portfolio with total-return prices (dividends reinvested),
 * rebalanced to target weights on the first trading day of each month.
 */
export function backtestPortfolio(dates: string[], series: number[][], weights: number[], initial: number) {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const w = weights.map((x) => x / total);
  const values: number[] = [];
  let units = w.map((wi, k) => (initial * wi) / series[k][0]);
  for (let i = 0; i < dates.length; i++) {
    let v = 0;
    for (let k = 0; k < series.length; k++) v += units[k] * series[k][i];
    if (i > 0 && dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7)) {
      units = w.map((wi, k) => (v * wi) / series[k][i]); // monthly rebalance at today's close
    }
    values.push(v);
  }
  return values;
}

export function summarize(values: number[], dates: string[], perYear = 252) {
  const yrs = dates.length > 1 ? yearsBetween(dates[0], dates[dates.length - 1]) : 0;
  const dd = maxDrawdown(values);
  return {
    totalReturn: values.length ? values[values.length - 1] / values[0] - 1 : 0,
    cagr: cagr(values[0], values[values.length - 1], yrs),
    volatility: annualizedVolatility(values, perYear),
    maxDrawdown: dd.pct,
    maxDrawdownPeak: dates[dd.peakIndex],
    maxDrawdownTrough: dates[dd.troughIndex],
    years: yrs,
  };
}

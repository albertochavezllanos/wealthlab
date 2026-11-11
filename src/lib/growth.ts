/**
 * Future growth projection engine (pure math, no data).
 *
 * Conventions (match Excel's FV with type = 0):
 *  - The annual return is a nominal rate compounded monthly: monthly rate = annual / 12.
 *  - Each month: growth is applied first, then the month's contribution is added
 *    and any withdrawal is taken (end-of-month cash flows).
 *  - Contributions stop when withdrawals begin.
 *  - Contribution increases apply once per year (at the start of years 2, 3, ...).
 */

export interface GrowthInputs {
  initial: number; // starting amount ($)
  monthly: number; // monthly contribution ($)
  years: number; // horizon, whole years
  annualReturn: number; // assumed, percent (e.g. 6 for 6%)
  contributionIncrease: number; // percent per year the monthly contribution rises
  withdrawalStartYear: number; // 0 = no withdrawals; otherwise year number (1-based) withdrawals begin
  monthlyWithdrawal: number; // $ per month once withdrawals begin
  inflation: number; // percent per year, used for "today's dollars"
}

export interface YearRow {
  year: number;
  contributions: number; // added during this year (including the initial amount in year 1)
  withdrawals: number; // taken during this year
  growth: number; // investment growth during this year
  endValue: number;
  totalContributed: number; // cumulative, including the initial amount
  totalWithdrawn: number; // cumulative
  endValueReal: number; // in today's dollars
}

export interface GrowthResult {
  finalValue: number;
  finalValueReal: number;
  totalContributed: number;
  totalWithdrawn: number;
  /** Investment gains = final value + money taken out - money put in */
  gains: number;
  rows: YearRow[];
  /** True if withdrawals emptied the account before the end */
  depleted: boolean;
  depletedYear: number | null;
}

export const DEFAULT_INPUTS: GrowthInputs = {
  initial: 10000,
  monthly: 500,
  years: 30,
  annualReturn: 6,
  contributionIncrease: 0,
  withdrawalStartYear: 0,
  monthlyWithdrawal: 0,
  inflation: 2.5,
};

export function clampInputs(i: GrowthInputs): GrowthInputs {
  const c = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
  return {
    initial: c(i.initial, 0, 100_000_000),
    monthly: c(i.monthly, 0, 1_000_000),
    years: Math.round(c(i.years, 1, 60)),
    annualReturn: c(i.annualReturn, -20, 30),
    contributionIncrease: c(i.contributionIncrease, 0, 20),
    withdrawalStartYear: Math.round(c(i.withdrawalStartYear, 0, 60)),
    monthlyWithdrawal: c(i.monthlyWithdrawal, 0, 1_000_000),
    inflation: c(i.inflation, 0, 15),
  };
}

export function project(raw: GrowthInputs): GrowthResult {
  const inp = clampInputs(raw);
  const r = inp.annualReturn / 100 / 12;
  const infl = inp.inflation / 100;
  const withdrawStart = inp.withdrawalStartYear > 0 && inp.monthlyWithdrawal > 0 ? inp.withdrawalStartYear : 0;

  let value = inp.initial;
  let totalContributed = inp.initial;
  let totalWithdrawn = 0;
  let contribution = inp.monthly;
  let depletedYear: number | null = null;
  const rows: YearRow[] = [];

  for (let y = 1; y <= inp.years; y++) {
    if (y > 1) contribution *= 1 + inp.contributionIncrease / 100;
    const withdrawing = withdrawStart > 0 && y >= withdrawStart;
    let yContrib = y === 1 ? inp.initial : 0;
    let yWithdraw = 0;
    let yGrowth = 0;

    for (let m = 0; m < 12; m++) {
      const g = value * r;
      value += g;
      yGrowth += g;
      if (withdrawing) {
        const w = Math.min(value, inp.monthlyWithdrawal);
        value -= w;
        yWithdraw += w;
        if (value <= 1e-9 && depletedYear === null) {
          value = 0;
          depletedYear = y;
        }
      } else {
        value += contribution;
        yContrib += contribution;
      }
    }

    totalContributed += y === 1 ? yContrib - inp.initial : yContrib;
    totalWithdrawn += yWithdraw;
    rows.push({
      year: y,
      contributions: yContrib,
      withdrawals: yWithdraw,
      growth: yGrowth,
      endValue: value,
      totalContributed,
      totalWithdrawn,
      endValueReal: value / Math.pow(1 + infl, y),
    });
  }

  const finalValue = value;
  return {
    finalValue,
    finalValueReal: finalValue / Math.pow(1 + infl, inp.years),
    totalContributed,
    totalWithdrawn,
    gains: finalValue + totalWithdrawn - totalContributed,
    rows,
    depleted: depletedYear !== null,
    depletedYear,
  };
}

/** Excel FV(rate, nper, pmt, pv, type=0), returned as a positive balance for negative pmt/pv inputs. */
export function excelFV(rate: number, nper: number, pmt: number, pv: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  const f = Math.pow(1 + rate, nper);
  return -(pv * f + (pmt * (f - 1)) / rate);
}

/**
 * Cost of waiting: invest now for `years`, vs. wait `delay` years and invest for the remaining time.
 * Same monthly amount, same starting amount, same end date.
 */
export function costOfWaiting(inp: GrowthInputs, delay: number) {
  const base = clampInputs({ ...inp, withdrawalStartYear: 0, monthlyWithdrawal: 0 });
  const d = Math.max(0, Math.min(base.years - 1, Math.round(delay)));
  const now = project(base);
  const later = project({ ...base, years: base.years - d });
  const i = base.annualReturn / 100 / 12;
  const n = (base.years - d) * 12;
  // Monthly amount the late starter would need (flat contributions) to reach the same final value
  const f = Math.pow(1 + i, n);
  const needed = i === 0 ? (now.finalValue - base.initial) / n : ((now.finalValue - base.initial * f) * i) / (f - 1);
  return {
    delay: d,
    now,
    later,
    cost: now.finalValue - later.finalValue,
    monthlyNeededToCatchUp: Math.max(0, needed),
  };
}

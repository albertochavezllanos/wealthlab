/**
 * WealthLab Time Machine — portfolio accounting engine.
 *
 * Rules (also explained on the Methodology page):
 *  - Prices are real end-of-day closes (raw, unadjusted). Every transaction executes at the
 *    close of its date, or the next trading day if the market was closed.
 *  - The trading calendar is SPY's (U.S. market days). Crypto is valued on those days too.
 *  - Splits: on the split date, shares are multiplied by the split factor; total cost basis is
 *    unchanged, so position value is unchanged by the split itself.
 *  - Dividends: credited on the ex-dividend date to shares held at the prior close (before that
 *    day's transactions), either as cash or reinvested at that day's close. Never both.
 *  - Fractional shares are allowed. No taxes, fees, or slippage.
 *  - Invalid actions (overselling, buying without enough cash, no price yet) are blocked and
 *    reported, never partially applied.
 */
import type { PriceHistory, PriceRow } from "./types";

export type DividendMode = "cash" | "reinvest";

export type Amount =
  | { kind: "dollars"; value: number }
  | { kind: "shares"; value: number }
  | { kind: "percent"; value: number } // buy: % of cash · sell/switch: % of position
  | { kind: "all" }; // buy: all cash · sell/switch: whole position

export type Action =
  | { id: string; type: "buy"; date: string; ticker: string; amount: Amount }
  | { id: string; type: "sell"; date: string; ticker: string; amount: Amount }
  | { id: string; type: "switch"; date: string; ticker: string; toTicker: string; amount: Amount }
  | { id: string; type: "deposit"; date: string; value: number }
  | { id: string; type: "withdraw"; date: string; value: number }
  | { id: string; type: "recurring"; date: string; endDate?: string; ticker: string; value: number };

/** An action before it has an id (distributes Omit over the union). */
export type ActionInput = Action extends infer A ? (A extends Action ? Omit<A, "id"> : never) : never;

export interface Timeline {
  id: string;
  name: string;
  parentId?: string;
  startDate: string;
  endDate: string;
  startingCash: number;
  dividendMode: DividendMode;
  actions: Action[];
}

export type EntryType = "start" | "deposit" | "withdraw" | "buy" | "sell" | "dividend" | "reinvest" | "split";

export interface LedgerEntry {
  date: string;
  type: EntryType;
  actionId?: string;
  ticker?: string;
  shares?: number; // shares bought (+) or sold (-), or new shares from a split
  price?: number; // execution price
  amount: number; // cash effect (+ in, - out); 0 for splits
  realizedGain?: number;
  note?: string;
  cashAfter: number;
  holdingsAfter: number;
  totalAfter: number;
  /** cash + sum(shares x price) recomputed independently equals totalAfter (to the cent) */
  balanced: boolean;
}

export interface Issue {
  actionId: string;
  date: string;
  message: string;
}

export interface Position {
  ticker: string;
  shares: number;
  costBasis: number; // total dollars invested in current shares
  price: number;
  value: number;
  priceDate: string;
}

export interface DayPoint {
  date: string;
  cash: number;
  holdings: number;
  total: number;
  netDeposits: number; // starting cash + deposits - withdrawals so far
}

export interface SimResult {
  days: DayPoint[];
  ledger: LedgerEntry[];
  issues: Issue[];
  positions: Position[];
  /** External cash flows actually executed (used to build the SPY benchmark) */
  flows: { date: string; amount: number }[];
  realizedGain: number;
  dividendsReceived: number;
  stalePrices: { ticker: string; date: string; priceDate: string }[];
  /** Independent cash reconciliation: starting cash + deposits - withdrawals - buys + sells + cash dividends */
  cashReconciles: boolean;
  /** Dates on which a recorded transaction actually executed, keyed by action id (first occurrence) */
  executedOn: Record<string, string>;
  start: string;
  end: string;
}

const EPS = 1e-6;

/** Expand recurring actions into individual deposit + buy pairs, then order everything. */
export function expandActions(t: Timeline, calendar: string[]): Action[] {
  const out: Action[] = [];
  for (const a of t.actions) {
    if (a.type !== "recurring") {
      out.push(a);
      continue;
    }
    const day = Number(a.date.slice(8, 10));
    const last = a.endDate && a.endDate < t.endDate ? a.endDate : t.endDate;
    let y = Number(a.date.slice(0, 4));
    let m = Number(a.date.slice(5, 7));
    for (let k = 0; k < 1200; k++) {
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const d = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, dim)).padStart(2, "0")}`;
      if (d > last) break;
      if (d >= a.date && calendar.length) {
        const occ = `${a.id}#${k}`;
        out.push({ id: occ, type: "deposit", date: d, value: a.value });
        out.push({ id: `${occ}b`, type: "buy", date: d, ticker: a.ticker, amount: { kind: "dollars", value: a.value } });
      }
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  // Stable sort by date, keeping the user's order within a day
  return out.map((a, i) => ({ a, i })).sort((x, y) => (x.a.date < y.a.date ? -1 : x.a.date > y.a.date ? 1 : x.i - y.i)).map((x) => x.a);
}

/** Tickers a timeline needs price data for. */
export function tickersOf(t: Timeline): string[] {
  const s = new Set<string>();
  for (const a of t.actions) {
    if ("ticker" in a && a.ticker) s.add(a.ticker.toUpperCase());
    if (a.type === "switch") s.add(a.toTicker.toUpperCase());
  }
  return [...s];
}

interface TickerState {
  rows: PriceRow[];
  ptr: number; // index of last row with date <= current day, or -1
  shares: number;
  basis: number;
}

export function simulate(t: Timeline, histories: Record<string, PriceHistory>, calendarRows: PriceRow[]): SimResult {
  const calendar = calendarRows.map((r) => r[0]).filter((d) => d >= t.startDate && d <= t.endDate);
  const issues: Issue[] = [];
  const ledger: LedgerEntry[] = [];
  const days: DayPoint[] = [];
  const flows: { date: string; amount: number }[] = [];
  const stalePrices: SimResult["stalePrices"] = [];
  const executedOn: Record<string, string> = {};
  let realizedGain = 0;
  let dividendsReceived = 0;

  if (calendar.length === 0) {
    return {
      days, ledger, issues: [{ actionId: "setup", date: t.startDate, message: "No trading days fall between the start and end dates." }],
      positions: [], flows, realizedGain, dividendsReceived, stalePrices, cashReconciles: true, executedOn, start: t.startDate, end: t.endDate,
    };
  }

  const state = new Map<string, TickerState>();
  const get = (tk: string): TickerState | undefined => {
    const T = tk.toUpperCase();
    if (!state.has(T)) {
      const h = histories[T];
      if (!h) return undefined;
      state.set(T, { rows: h.rows, ptr: -1, shares: 0, basis: 0 });
    }
    return state.get(T);
  };

  let cash = 0;
  let netDeposits = 0;
  // Independent running totals for the cash reconciliation check
  let recDeposits = 0, recWithdrawals = 0, recBuys = 0, recSells = 0, recCashDivs = 0;

  const priceOf = (s: TickerState) => (s.ptr >= 0 ? s.rows[s.ptr][1] : NaN);
  const holdingsValue = () => {
    let v = 0;
    for (const s of state.values()) if (s.shares > EPS) v += s.shares * priceOf(s);
    return v;
  };
  // Independent recomputation for the "balanced" check (does not reuse holdingsValue's loop)
  const recompute = () =>
    cash + [...state.values()].reduce((sum, s) => sum + (s.shares > EPS ? s.shares * s.rows[s.ptr][1] : 0), 0);

  const record = (e: Omit<LedgerEntry, "cashAfter" | "holdingsAfter" | "totalAfter" | "balanced">) => {
    const h = holdingsValue();
    const total = cash + h;
    ledger.push({ ...e, cashAfter: cash, holdingsAfter: h, totalAfter: total, balanced: Math.abs(recompute() - total) < 0.005 });
  };

  const actions = expandActions(t, calendar);
  let ai = 0;
  // Actions before the start date are invalid
  while (ai < actions.length && actions[ai].date < t.startDate) {
    issues.push({ actionId: baseId(actions[ai].id), date: actions[ai].date, message: "This action is before the timeline's start date, so it was skipped." });
    ai++;
  }

  for (let di = 0; di < calendar.length; di++) {
    const d = calendar[di];

    // 1) Advance every tracked ticker to today, applying splits and dividends on the way
    for (const [tk, s] of state) {
      while (s.ptr + 1 < s.rows.length && s.rows[s.ptr + 1][0] <= d) {
        s.ptr++;
        const [rd, close, , div, split] = s.rows[s.ptr];
        if (s.shares > EPS && split && split !== 1) {
          const before = s.shares;
          s.shares *= split;
          record({ date: rd, type: "split", ticker: tk, shares: s.shares - before, price: close, amount: 0, note: `${fmtSplit(split)} split: ${num(before)} → ${num(s.shares)} shares. Cost basis unchanged.` });
        }
        if (s.shares > EPS && div > 0) {
          const amount = s.shares * div;
          dividendsReceived += amount;
          if (t.dividendMode === "reinvest") {
            const add = amount / close;
            s.shares += add;
            s.basis += amount;
            record({ date: rd, type: "reinvest", ticker: tk, shares: add, price: close, amount: 0, note: `Dividend $${div.toFixed(4)}/share = $${amount.toFixed(2)} reinvested at the close.` });
          } else {
            cash += amount;
            recCashDivs += amount;
            record({ date: rd, type: "dividend", ticker: tk, amount, note: `Dividend $${div.toFixed(4)}/share on ${num(s.shares)} shares.` });
          }
        }
      }
    }

    // 2) Starting cash on the first trading day
    if (di === 0) {
      cash += t.startingCash;
      netDeposits += t.startingCash;
      recDeposits += t.startingCash;
      flows.push({ date: d, amount: t.startingCash });
      record({ date: d, type: "start", amount: t.startingCash, note: "Starting cash" });
    }

    // 3) Execute actions dated on or before today (non-trading-day actions roll forward)
    while (ai < actions.length && actions[ai].date <= d) {
      const a = actions[ai++];
      const fail = (message: string) => issues.push({ actionId: baseId(a.id), date: d, message });
      const mark = () => {
        if (!executedOn[baseId(a.id)]) executedOn[baseId(a.id)] = d;
      };

      if (a.type === "deposit") {
        if (!(a.value > 0)) { fail("Deposit amount must be more than $0."); continue; }
        cash += a.value; netDeposits += a.value; recDeposits += a.value;
        flows.push({ date: d, amount: a.value });
        mark();
        record({ date: d, type: "deposit", actionId: a.id, amount: a.value, note: isRecurring(a.id) ? "Recurring contribution" : undefined });
        continue;
      }
      if (a.type === "withdraw") {
        if (!(a.value > 0)) { fail("Withdrawal amount must be more than $0."); continue; }
        if (a.value > cash + EPS) { fail(`Not enough cash to withdraw $${a.value.toFixed(2)}: only $${cash.toFixed(2)} in cash. Sell something first.`); continue; }
        cash -= a.value; netDeposits -= a.value; recWithdrawals += a.value;
        flows.push({ date: d, amount: -a.value });
        mark();
        record({ date: d, type: "withdraw", actionId: a.id, amount: -a.value });
        continue;
      }
      if (a.type === "recurring") continue; // already expanded

      const s = get(a.ticker);
      if (!s) { fail(`No price data for ${a.ticker}.`); continue; }
      catchUp(s, d);
      if (s.ptr < 0) { fail(`${a.ticker} has no price on or before ${d} (it may not have existed yet).`); continue; }
      const px = priceOf(s);
      noteStale(a.ticker, s, d);

      if (a.type === "buy") {
        let dollars: number;
        if (a.amount.kind === "dollars") dollars = a.amount.value;
        else if (a.amount.kind === "shares") dollars = a.amount.value * px;
        else if (a.amount.kind === "percent") dollars = (cash * a.amount.value) / 100;
        else dollars = cash;
        if (!(dollars > 0)) { fail(a.amount.kind === "all" || a.amount.kind === "percent" ? `No cash available to buy ${a.ticker}.` : "Buy amount must be more than $0."); continue; }
        if (dollars > cash + EPS) { fail(`Not enough cash to buy $${dollars.toFixed(2)} of ${a.ticker}: only $${cash.toFixed(2)} available.`); continue; }
        dollars = Math.min(dollars, cash);
        const sh = dollars / px;
        cash -= dollars; s.shares += sh; s.basis += dollars; recBuys += dollars;
        mark();
        record({ date: d, type: "buy", actionId: a.id, ticker: a.ticker.toUpperCase(), shares: sh, price: px, amount: -dollars, note: isRecurring(a.id) ? "Recurring purchase" : undefined });
        continue;
      }

      // sell or switch: work out shares to sell
      let sh: number;
      if (a.amount.kind === "dollars") sh = a.amount.value / px;
      else if (a.amount.kind === "shares") sh = a.amount.value;
      else if (a.amount.kind === "percent") sh = (s.shares * a.amount.value) / 100;
      else sh = s.shares;
      if (s.shares <= EPS) { fail(`You don't own any ${a.ticker} on ${d}.`); continue; }
      if (!(sh > 0)) { fail("Sell amount must be more than 0."); continue; }
      if (sh > s.shares * (1 + 1e-9) + EPS) { fail(`Can't sell ${num(sh)} shares of ${a.ticker}: you only own ${num(s.shares)}.`); continue; }
      sh = Math.min(sh, s.shares);

      let target: TickerState | undefined;
      let tpx = NaN;
      if (a.type === "switch") {
        target = get(a.toTicker);
        if (!target) { fail(`No price data for ${a.toTicker}.`); continue; }
        catchUp(target, d);
        if (target.ptr < 0) { fail(`${a.toTicker} has no price on or before ${d}.`); continue; }
        tpx = priceOf(target);
        noteStale(a.toTicker, target, d);
      }

      const proceeds = sh * px;
      const basisSold = s.basis * (sh / s.shares);
      const gain = proceeds - basisSold;
      realizedGain += gain;
      s.shares -= sh; s.basis -= basisSold;
      if (s.shares < 1e-9) { s.shares = 0; s.basis = 0; }
      cash += proceeds; recSells += proceeds;
      mark();
      record({ date: d, type: "sell", actionId: a.id, ticker: a.ticker.toUpperCase(), shares: -sh, price: px, amount: proceeds, realizedGain: gain, note: a.type === "switch" ? `Switch to ${a.toTicker.toUpperCase()}` : undefined });

      if (a.type === "switch" && target) {
        const tsh = proceeds / tpx;
        cash -= proceeds; target.shares += tsh; target.basis += proceeds; recBuys += proceeds;
        record({ date: d, type: "buy", actionId: a.id, ticker: a.toTicker.toUpperCase(), shares: tsh, price: tpx, amount: -proceeds, note: `Switch from ${a.ticker.toUpperCase()}` });
      }
    }

    const h = holdingsValue();
    days.push({ date: d, cash, holdings: h, total: cash + h, netDeposits });
  }

  // Actions after the end date
  for (; ai < actions.length; ai++) {
    issues.push({ actionId: baseId(actions[ai].id), date: actions[ai].date, message: "This action is after the timeline's end date, so it was skipped." });
  }

  const endDate = calendar[calendar.length - 1];
  const positions: Position[] = [];
  for (const [tk, s] of state) {
    if (s.shares > EPS) {
      positions.push({ ticker: tk, shares: s.shares, costBasis: s.basis, price: priceOf(s), value: s.shares * priceOf(s), priceDate: s.rows[s.ptr][0] });
    }
  }
  positions.sort((a, b) => b.value - a.value);

  const expectedCash = recDeposits - recWithdrawals - recBuys + recSells + recCashDivs;

  return {
    days, ledger, issues: dedupeIssues(issues), positions, flows, realizedGain, dividendsReceived,
    stalePrices, cashReconciles: Math.abs(expectedCash - cash) < 0.01, executedOn,
    start: calendar[0], end: endDate,
  };

  function catchUp(s: TickerState, d: string) {
    // A ticker first touched today: move its pointer to today without retroactive events
    if (s.ptr === -1 && s.shares === 0) {
      while (s.ptr + 1 < s.rows.length && s.rows[s.ptr + 1][0] <= d) s.ptr++;
    }
  }
  function noteStale(tk: string, s: TickerState, d: string) {
    const pd = s.rows[s.ptr][0];
    if (pd < d && histories[tk.toUpperCase()]?.assetType !== "Crypto") stalePrices.push({ ticker: tk.toUpperCase(), date: d, priceDate: pd });
  }
}

/**
 * Benchmark: the same external cash flows (starting cash, deposits, withdrawals) invested in SPY.
 * Each deposit buys SPY at that day's close; each withdrawal sells just enough SPY.
 */
export function benchmark(flows: { date: string; amount: number }[], t: Timeline, histories: Record<string, PriceHistory>, calendarRows: PriceRow[], ticker = "SPY"): SimResult {
  const actions: Action[] = [];
  let k = 0;
  for (const f of flows.slice(1)) {
    if (f.amount > 0) {
      actions.push({ id: `bd${k}`, type: "deposit", date: f.date, value: f.amount });
      actions.push({ id: `bb${k++}`, type: "buy", date: f.date, ticker, amount: { kind: "dollars", value: f.amount } });
    } else {
      actions.push({ id: `bs${k}`, type: "sell", date: f.date, ticker, amount: { kind: "dollars", value: -f.amount } });
      actions.push({ id: `bw${k++}`, type: "withdraw", date: f.date, value: -f.amount });
    }
  }
  const startDate = flows[0]?.date ?? t.startDate;
  const bt: Timeline = {
    id: "benchmark", name: `Hold ${ticker}`, startDate: t.startDate, endDate: t.endDate,
    // "Simply holding SPY" = dividends reinvested, the standard total-return benchmark
    startingCash: flows[0]?.amount ?? t.startingCash, dividendMode: "reinvest",
    actions: [{ id: "b0", type: "buy", date: startDate, ticker, amount: { kind: "all" } }, ...actions],
  };
  return simulate(bt, histories, calendarRows);
}

function baseId(id: string) {
  return id.split("#")[0];
}
function isRecurring(id: string) {
  return id.includes("#");
}
function dedupeIssues(list: Issue[]) {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.actionId}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function num(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtSplit(f: number) {
  return f >= 1 ? `${f}-for-1` : `1-for-${Math.round(1 / f)}`;
}

/** Make a fresh copy of a timeline for an alternate path (original is never mutated). */
export function branch(t: Timeline, newId: string, name: string): Timeline {
  return { ...structuredClone(t), id: newId, name, parentId: t.id };
}

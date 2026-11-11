// Run: node scripts/test-timemachine.ts   (uses REAL Tiingo data; needs TIINGO_API_KEY in .env.local)
import { readFileSync } from "node:fs";
import { simulate, benchmark, branch, type Timeline } from "../src/lib/timemachine.ts";

type Row = [string, number, number, number, number];
interface H { ticker: string; name: string; assetType: "Stock" | "ETF"; source: string; fetchedAt: string; firstDate: string; lastDate: string; rows: Row[] }

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

async function load(ticker: string, start = "2019-01-01"): Promise<H> {
  const res = await fetch(`https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${start}`, {
    headers: { Authorization: `Token ${env.TIINGO_API_KEY}` },
  });
  if (!res.ok) throw new Error(`${ticker}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { date: string; close: number; adjClose: number; divCash: number; splitFactor: number }[];
  const rows: Row[] = data.map((d) => [d.date.slice(0, 10), d.close, d.adjClose, d.divCash || 0, d.splitFactor || 1]);
  return { ticker, name: ticker, assetType: "Stock", source: "test", fetchedAt: "", firstDate: rows[0][0], lastDate: rows[rows.length - 1][0], rows };
}

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};
const close = (a: number, b: number, relTol: number) => Math.abs(a - b) <= Math.abs(b) * relTol;

const [NVDA, AAPL, SPY, KO] = await Promise.all([load("NVDA"), load("AAPL"), load("SPY"), load("KO")]);
const H = { NVDA, AAPL, SPY, KO } as Record<string, H>;
const cal = SPY.rows;

function base(over: Partial<Timeline>): Timeline {
  return { id: "t", name: "t", startDate: "2020-01-02", endDate: "2024-12-31", startingCash: 10000, dividendMode: "reinvest", actions: [], ...over };
}

// ---------- Splits do not change position value ----------
function splitCheck(ticker: string, splitDate: string, factor: number, buyDate: string, endDate: string) {
  const t = base({ startDate: buyDate, endDate, dividendMode: "cash", actions: [{ id: "a", type: "buy", date: buyDate, ticker, amount: { kind: "all" } }] });
  const r = simulate(t, H, cal);
  const i = r.days.findIndex((d) => d.date === splitDate);
  const before = r.days[i - 1], after = r.days[i];
  const rows = H[ticker].rows;
  const ri = rows.findIndex((x) => x[0] === splitDate);
  const priceMove = (rows[ri][1] * factor) / rows[ri - 1][1]; // split-adjusted price change that day
  const splitEntry = r.ledger.find((e) => e.type === "split" && e.date === splitDate);
  ok(`${ticker} ${splitDate} ${factor}-for-1: split recorded`, !!splitEntry);
  // Compare the stock position only (dividend cash, if any, doesn't move with the price)
  ok(`${ticker} ${splitDate}: position value moves only by the market's price change, not the split`,
    close(after.holdings / before.holdings, priceMove, 1e-9), `value ratio ${(after.holdings / before.holdings).toFixed(6)} vs price move ${priceMove.toFixed(6)}`);
  ok(`${ticker} ${splitDate}: cash untouched by the split`, Math.abs(after.cash - before.cash) < 1e-9);
  const sharesBefore = r.ledger.filter((e) => e.date < splitDate && e.ticker === ticker && e.shares).reduce((s, e) => s + (e.shares ?? 0), 0);
  ok(`${ticker} ${splitDate}: share count multiplied by exactly ${factor}`, close(sharesBefore + (splitEntry?.shares ?? 0), sharesBefore * factor, 1e-12));
  return r;
}
splitCheck("AAPL", "2020-08-31", 4, "2020-08-03", "2020-09-30");
splitCheck("NVDA", "2021-07-20", 4, "2021-07-01", "2021-08-31");
splitCheck("NVDA", "2024-06-10", 10, "2024-05-01", "2024-06-30");

// ---------- Across BOTH NVDA splits, reinvested total return matches Tiingo's adjusted-close total return ----------
{
  const t = base({ startDate: "2021-01-04", endDate: "2024-12-31", dividendMode: "reinvest", actions: [{ id: "a", type: "buy", date: "2021-01-04", ticker: "NVDA", amount: { kind: "all" } }] });
  const r = simulate(t, H, cal);
  const rows = NVDA.rows;
  const s = rows.find((x) => x[0] === "2021-01-04")!, e = rows.find((x) => x[0] === r.end)!;
  const expected = 10000 * (e[2] / s[2]);
  ok("NVDA 2021→2024 (both splits), dividends reinvested ≈ Tiingo adjusted total return", close(r.days.at(-1)!.total, expected, 0.002),
    `engine $${r.days.at(-1)!.total.toFixed(2)} vs adjClose $${expected.toFixed(2)}`);
}

// ---------- Dividends: cash vs reinvest, never double counted ----------
{
  const mk = (mode: "cash" | "reinvest") => simulate(base({ dividendMode: mode, startDate: "2021-01-04", endDate: "2023-12-29", actions: [{ id: "a", type: "buy", date: "2021-01-04", ticker: "KO", amount: { kind: "all" } }] }), H, cal);
  const cashR = mk("cash"), reR = mk("reinvest");
  const shares = 10000 / KO.rows.find((x) => x[0] === "2021-01-04")![1];
  const divSum = KO.rows.filter((x) => x[0] > "2021-01-04" && x[0] <= cashR.end).reduce((s, x) => s + x[3], 0);
  const endPx = KO.rows.find((x) => x[0] === cashR.end)![1];
  const expectedCashMode = shares * endPx + shares * divSum; // KO had no splits in this window
  ok("KO cash mode: final = shares × price + dividends received", close(cashR.days.at(-1)!.total, expectedCashMode, 1e-9),
    `$${cashR.days.at(-1)!.total.toFixed(2)} vs $${expectedCashMode.toFixed(2)}`);
  ok("KO cash mode: dividends sit in cash, shares unchanged", close(cashR.positions[0].shares, shares, 1e-12) && close(cashR.days.at(-1)!.cash, shares * divSum, 1e-9));
  ok("KO reinvest mode: no dividend cash, more shares", reR.days.at(-1)!.cash < 1e-6 && reR.positions[0].shares > shares);
  const s = KO.rows.find((x) => x[0] === "2021-01-04")!, e = KO.rows.find((x) => x[0] === reR.end)!;
  ok("KO reinvest ≈ Tiingo adjusted total return", close(reR.days.at(-1)!.total, 10000 * (e[2] / s[2]), 0.002),
    `$${reR.days.at(-1)!.total.toFixed(2)} vs $${(10000 * (e[2] / s[2])).toFixed(2)}`);
  ok("Same dividend dollars credited in either mode (first payment)",
    close(cashR.ledger.find((x) => x.type === "dividend")!.amount, reR.ledger.find((x) => x.type === "reinvest")!.shares! * reR.ledger.find((x) => x.type === "reinvest")!.price!, 1e-9));
  ok("No double counting: cash mode has zero reinvest entries, reinvest mode has zero cash dividends",
    !cashR.ledger.some((x) => x.type === "reinvest") && !reR.ledger.some((x) => x.type === "dividend"));
}

// ---------- Cash + holdings = portfolio value after every transaction; cash reconciles ----------
{
  const t = base({
    startDate: "2020-01-02", endDate: "2024-12-31", dividendMode: "cash",
    actions: [
      { id: "1", type: "buy", date: "2020-01-02", ticker: "AAPL", amount: { kind: "dollars", value: 4000 } },
      { id: "2", type: "buy", date: "2020-01-02", ticker: "NVDA", amount: { kind: "percent", value: 50 } },
      { id: "3", type: "recurring", date: "2020-02-15", endDate: "2021-12-31", ticker: "SPY", value: 250 },
      { id: "4", type: "sell", date: "2020-03-16", ticker: "AAPL", amount: { kind: "percent", value: 50 } },
      { id: "5", type: "switch", date: "2022-06-01", ticker: "NVDA", toTicker: "KO", amount: { kind: "all" } },
      { id: "6", type: "withdraw", date: "2023-01-03", value: 1000 },
      { id: "7", type: "deposit", date: "2023-06-01", value: 5000 },
      { id: "8", type: "buy", date: "2023-06-01", ticker: "SPY", amount: { kind: "all" } },
    ],
  });
  const r = simulate(t, H, cal);
  ok("Every ledger entry balanced (cash + Σ shares×price = total)", r.ledger.every((e) => e.balanced), `${r.ledger.length} entries`);
  ok("Cash reconciles independently", r.cashReconciles);
  ok("No unexpected issues", r.issues.length === 0, r.issues.map((i) => i.message).join("; "));
  ok("Daily: total = cash + holdings every day", r.days.every((d) => Math.abs(d.total - d.cash - d.holdings) < 1e-6), `${r.days.length} days`);
  ok("Recurring contributions executed monthly (23 months)", r.ledger.filter((e) => e.type === "deposit" && e.note === "Recurring contribution").length === 23);

  // ---------- Alternate timeline: copy, edit, original unchanged ----------
  const before = JSON.stringify(t);
  const alt = branch(t, "alt", "Never sold");
  alt.actions = alt.actions.filter((a) => a.id !== "4");
  const ra = simulate(alt, H, cal);
  ok("Branch: original timeline object unchanged", JSON.stringify(t) === before);
  ok("Branch: alternate result differs", Math.abs(ra.days.at(-1)!.total - r.days.at(-1)!.total) > 1);

  // ---------- Benchmark uses the same cash flows ----------
  const b = benchmark(r.flows, t, H, cal);
  const inflows = r.flows.reduce((s, f) => s + f.amount, 0);
  const bInflows = b.flows.reduce((s, f) => s + f.amount, 0);
  ok("Benchmark has identical net cash flows", Math.abs(inflows - bInflows) < 0.01, `$${inflows.toFixed(2)} vs $${bInflows.toFixed(2)}`);
  ok("Benchmark ledger balanced and reconciles", b.ledger.every((e) => e.balanced) && b.cashReconciles && b.issues.length === 0, b.issues.map((i) => i.message).join("; "));
}

// ---------- Benchmark of a pure SPY timeline equals the timeline ----------
{
  const t = base({ startDate: "2020-01-02", endDate: "2024-12-31", actions: [{ id: "a", type: "buy", date: "2020-01-02", ticker: "SPY", amount: { kind: "all" } }] });
  const r = simulate(t, H, cal), b = benchmark(r.flows, t, H, cal);
  ok("Pure SPY timeline equals SPY benchmark", close(r.days.at(-1)!.total, b.days.at(-1)!.total, 1e-12));
}

// ---------- Invalid actions are blocked ----------
{
  const t = base({
    startDate: "2020-01-02", endDate: "2020-12-31",
    actions: [
      { id: "over", type: "buy", date: "2020-01-02", ticker: "AAPL", amount: { kind: "dollars", value: 20000 } },
      { id: "buy", type: "buy", date: "2020-01-02", ticker: "AAPL", amount: { kind: "dollars", value: 5000 } },
      { id: "oversell", type: "sell", date: "2020-02-03", ticker: "AAPL", amount: { kind: "shares", value: 1000 } },
      { id: "nothing", type: "sell", date: "2020-02-03", ticker: "NVDA", amount: { kind: "all" } },
      { id: "wd", type: "withdraw", date: "2020-02-04", value: 9999 },
      { id: "early", type: "deposit", date: "2019-06-01", value: 100 },
    ],
  });
  const r = simulate(t, H, cal);
  const has = (id: string) => r.issues.some((i) => i.actionId === id);
  ok("Blocked: buying more than available cash", has("over"));
  ok("Blocked: selling more shares than owned", has("oversell"));
  ok("Blocked: selling a stock you don't own", has("nothing"));
  ok("Blocked: withdrawing more cash than available", has("wd"));
  ok("Blocked: action before start date", has("early"));
  ok("Valid buy still executed, books balanced", !has("buy") && r.ledger.every((e) => e.balanced) && r.cashReconciles);
}

// ---------- Weekend action rolls to next trading day ----------
{
  const r = simulate(base({ startDate: "2020-01-02", endDate: "2020-03-31", actions: [{ id: "w", type: "buy", date: "2020-02-01", ticker: "SPY", amount: { kind: "all" } }] }), H, cal);
  ok("Saturday Feb 1, 2020 buy executes Monday Feb 3 at that close", r.executedOn["w"] === "2020-02-03");
}

console.log(failed === 0 ? "\nALL TIME MACHINE TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

// Run: node scripts/test-growth.ts
import { project, excelFV, costOfWaiting, DEFAULT_INPUTS } from "../src/lib/growth.ts";

let failed = 0;
function check(label: string, actual: number, expected: number, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}`);
}

const base = { ...DEFAULT_INPUTS, contributionIncrease: 0, withdrawalStartYear: 0, monthlyWithdrawal: 0 };

// Excel: =FV(6%/12, 360, -500, -10000)
check("FV 6%, 30y, $500/mo, $10k start", project({ ...base, initial: 10000, monthly: 500, years: 30, annualReturn: 6 }).finalValue, excelFV(0.06 / 12, 360, -500, -10000));
// Excel: =FV(6%/12, 360, -500) = 502,257.52  (hard-coded value from Excel)
check("FV 6%, 30y, $500/mo (Excel 502,257.52)", project({ ...base, initial: 0, monthly: 500, years: 30, annualReturn: 6 }).finalValue, 502257.52);
// Excel: =FV(8%/12, 120, -250, -5000) = 56,834.71  (5000*1.00667^120 + 250*(1.00667^120-1)/0.00667)
check("FV 8%, 10y, $250/mo, $5k start (Excel 56,834.71)", project({ ...base, initial: 5000, monthly: 250, years: 10, annualReturn: 8 }).finalValue, 56834.71);
// Zero return: just the sum
check("0% return", project({ ...base, initial: 1000, monthly: 100, years: 5, annualReturn: 0 }).finalValue, 1000 + 100 * 60);
// Lump sum only: =FV(7%/12, 240, 0, -25000)
check("Lump sum 7%, 20y", project({ ...base, initial: 25000, monthly: 0, years: 20, annualReturn: 7 }).finalValue, excelFV(0.07 / 12, 240, 0, -25000));

// Identity: final = contributed - withdrawn + gains
const w = project({ ...base, initial: 50000, monthly: 1000, years: 30, annualReturn: 5, withdrawalStartYear: 21, monthlyWithdrawal: 3000, contributionIncrease: 3 });
check("Identity final = contributed - withdrawn + gains", w.finalValue, w.totalContributed - w.totalWithdrawn + w.gains);
// Year rows sum up
const sumContrib = w.rows.reduce((s, r) => s + r.contributions, 0);
check("Year rows: contributions sum to total", sumContrib, w.totalContributed);
const sumGrowth = w.rows.reduce((s, r) => s + r.growth, 0);
check("Year rows: growth sums to gains", sumGrowth, w.gains);

// Inflation: real value = nominal / (1+infl)^years
const inf = project({ ...base, initial: 10000, monthly: 0, years: 10, annualReturn: 0, inflation: 3 });
check("Inflation-adjusted value", inf.finalValueReal, 10000 / Math.pow(1.03, 10));

// Cost of waiting consistency
const cw = costOfWaiting({ ...base, initial: 0, monthly: 500, years: 30, annualReturn: 6 }, 10);
check("Cost of waiting: later = FV over 20y", cw.later.finalValue, excelFV(0.06 / 12, 240, -500, 0));
check("Catch-up payment reaches same target", excelFV(0.06 / 12, 240, -cw.monthlyNeededToCatchUp, 0), cw.now.finalValue);

// Depletion
const dep = project({ ...base, initial: 10000, monthly: 0, years: 10, annualReturn: 0, withdrawalStartYear: 1, monthlyWithdrawal: 1000 });
check("Depletion: value floors at 0", dep.finalValue, 0);
console.log(dep.depletedYear === 1 ? "PASS  Depletion year detected (year 1)" : `FAIL  depletion year ${dep.depletedYear}`);
if (dep.depletedYear !== 1) failed++;

console.log(failed === 0 ? "\nALL GROWTH TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

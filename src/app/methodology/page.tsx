import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Methodology" };

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "prices",
    title: "Price data",
    body: [
      "Prices come from Tiingo's end-of-day data: the official closing price for each trading day, never real-time quotes. Every price on screen shows the date it refers to. Crypto prices are Tiingo's daily close for the UTC calendar day.",
      "The Time Machine uses raw (unadjusted) closing prices together with Tiingo's split factors and dividend amounts, so every transaction happens at the price that actually traded that day. Charts in Invest are split-adjusted so a split doesn't look like a crash.",
      "Tiingo's free data is licensed for personal use, which is why this prototype sits behind a passcode. Data is cached on our server for up to 6 hours to stay within the free plan's limits.",
    ],
  },
  {
    id: "timing",
    title: "Transaction timing",
    body: [
      "Every buy, sell, deposit, and withdrawal executes at the close of the date you pick. If the market was closed that day (a weekend or holiday), it executes at the next trading day's close, and the decision list shows the actual execution date.",
      "The trading calendar is the U.S. stock market's (SPY's trading days). Recurring contributions add cash and buy on the same day of each month, rolling to the next trading day when needed.",
      "Fractional shares are allowed. Invalid actions are blocked and explained, never partially applied: selling more than you own, buying or withdrawing more than your cash, trading before an investment existed, or acting outside the timeline's dates.",
    ],
  },
  {
    id: "splits",
    title: "Stock splits",
    body: [
      "On a split date, your share count is multiplied by the split factor (for example, 10× for NVIDIA's 10-for-1 split on June 10, 2024). Your total cost basis does not change, so the split itself never changes your position's value. Only the market's price move that day does.",
      "Tested on real data: NVIDIA's 4-for-1 (July 20, 2021) and 10-for-1 (June 10, 2024) splits and Apple's 4-for-1 (August 31, 2020) split. In each case, position value changed by exactly the stock's split-adjusted price move that day, and the share count multiplied by exactly the split factor.",
    ],
  },
  {
    id: "dividends",
    title: "Dividends",
    body: [
      "Dividends are credited on the ex-dividend date to the shares you held at the prior close, before that day's trades. You choose per timeline: take them as cash (added to your cash balance) or reinvest them (buying more shares at that day's close). A dividend is recorded exactly once, in one of those two ways, never both.",
      "In reality, dividends are paid a few weeks after the ex-date. We credit them on the ex-date, a common simplification that slightly shifts timing but not amounts. Tested: with dividends reinvested, holding NVIDIA from 2021 to 2024 or Coca-Cola from 2021 to 2023 matches Tiingo's independently calculated total return to the cent.",
    ],
  },
  {
    id: "benchmark",
    title: "The S&P 500 benchmark",
    body: [
      "Every timeline is compared with simply holding SPY (an S&P 500 fund) over the same dates with the same cash flows: the starting cash and every deposit buy SPY that day, and every withdrawal sells just enough SPY. SPY's dividends are always reinvested, the standard way to measure total return.",
    ],
  },
  {
    id: "accounting",
    title: "Accounting checks",
    body: [
      "After every transaction, the ledger recomputes cash plus the value of every holding and confirms it equals the portfolio total (shown as ✓ in the ledger). Separately, the cash balance is reconciled from scratch: starting cash + deposits − withdrawals − purchases + sale proceeds + cash dividends.",
      "Realized gains use average cost. Reinvested dividends add to cost basis because they are new purchases.",
    ],
  },
  {
    id: "gaps",
    title: "Data gaps and limits",
    body: [
      "If an investment has no price on a trading day (a data gap, or a fund that reports later), we use its most recent earlier close and say so on screen. Investments can't be bought before their first available price.",
      "Our free data covers listed U.S. stocks, ETFs, mutual funds, and major crypto. It does not include companies that were delisted or went bankrupt, so historical replays can overstate how well a basket of past \"winners\" would have done (survivorship bias).",
    ],
  },
  {
    id: "ignored",
    title: "What simulations ignore",
    body: [
      "All simulations ignore taxes, trading fees and commissions, bid-ask spreads, and slippage (the difference between the closing price and the price you'd actually get). Uninvested cash earns no interest. Real-world results would differ, usually for the worse.",
      "Projected returns in the Invest tools are assumptions you choose, not predictions. Past performance does not predict future results.",
    ],
  },
  {
    id: "projections",
    title: "Future growth projections",
    body: [
      "The growth simulator compounds monthly at your assumed annual rate ÷ 12, with contributions at the end of each month. This matches Excel's FV function with type 0. Tested: $500 a month for 30 years at 6% gives $502,257.52, identical to =FV(6%/12, 360, -500).",
      "Today's-dollars figures divide by (1 + inflation) raised to the number of years.",
    ],
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Methodology"
        title="How WealthLab calculates what you see."
        description="A plain-English explanation of the data and accounting rules behind every number, and what the simulations leave out."
      />
      <Container className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Methodology sections" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-slate hover:text-navy">{s.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <Card key={s.id} as="section">
              <h2 id={s.id} className="scroll-mt-28 font-serif text-xl text-navy">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-charcoal">{p}</p>
              ))}
            </Card>
          ))}
          <p className="text-xs text-muted">Educational prototype, not investment advice. WealthLab is independent and not affiliated with any financial firm.</p>
        </div>
      </Container>
    </>
  );
}

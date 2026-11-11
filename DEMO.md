# WealthLab — Demo Kit

Live site: **https://wealthlab-theta.vercel.app** (passcode required: the one you chose)

---

## 1. Demo script (about 75 seconds)

> **[Home page]** "This is WealthLab, a wealth-planning prototype I built in one day by directing AI. It has three parts: planning forward, replaying history, and research. Everything runs on real data: Tiingo end-of-day prices and SEC filings."

> **[Invest → Growth simulator]** "Here's a future projection: $10,000 plus $500 a month at an assumed 6% for 30 years comes to about $562,000. I can flip to today's dollars, and the year-by-year table matches Excel's FV function. These are assumptions, not predictions."

> **[Time Machine → Build & compare]** "This is the signature feature. I invested $10,000 in the S&P 500 in January 2020, panicked and sold on March 16, then bought back in August. Every trade uses real closing prices, and the ledger checks that cash plus holdings equals the total after every transaction."

> **[Same screen: the two lines]** "Here's the alternate timeline where I simply stayed invested: about $19,000 versus $14,000. Same money, one decision. Both are compared against just holding SPY with the same cash flows."

> **[Intelligence → Markets & Pulse, then AI assistant]** "For research, Market Pulse is an AI briefing from a live web search. Every item links to its source and date, shown next to the real index numbers. And I can ask, 'Compare Nvidia, Microsoft, and Apple.' It pulls SEC filings and price history, cites every fact, separates facts from interpretation, and never says buy or sell."

> **[Close]** "I made the product and accounting decisions and tested everything; AI wrote the code. It's an educational prototype, not investment advice."

**Before the meeting:** open each screen once so the AI answers and prices are cached and load instantly (see Section 4).

---

## 2. What works

**WealthLab Invest**
- Search U.S. stocks, ETFs, mutual funds, and major crypto: end-of-day price, close date, asset type, split-adjusted chart (1M to Max), volatility, max drawdown, trailing dividends.
- Growth simulator: starting amount, monthly contributions, years, assumed return, yearly contribution raises, withdrawals; final value, total contributed, gains, principal-vs-growth chart, year-by-year table, today's-dollars view.
- Cost of Waiting: start now vs. later, plus the monthly amount needed to catch up.
- Compare up to 4 strategies side by side.
- Portfolio builder: up to 8 investments with weights, tested on real history (monthly rebalanced) vs. SPY, with volatility, drawdown, correlation, and concentration.
- Saved scenarios and portfolios: browser-only, stated on screen.

**WealthLab Time Machine**
- Any dates since 1993, starting cash, unlimited decisions: buy (dollars / shares / % of cash / all cash), sell (part or all), switch, add cash, withdraw, monthly investing.
- Daily cash, shares, average cost, sale proceeds, realized gains, and portfolio value from real closing prices.
- Invalid moves blocked with explanations (overselling, overspending, before an investment existed, outside the dates).
- Splits handled (shares multiply, value unchanged); dividends as cash or reinvested, never both.
- Alternate timelines: copy, edit any decision, compare on one chart with decision markers; the original stays unchanged.
- Every timeline compared with holding SPY using the same cash flows.
- Ledger with a ✓ balance check on every row; saved in the browser and auto-kept on the device.
- Replays: March 2020 crash (decide with only what was known, then reveal) and the 1999–2002 tech bubble ("right idea, wrong price").
- Methodology page: data, timing, splits, dividends, benchmark, accounting checks, data gaps, what's ignored.

**WealthLab Intelligence**
- Markets: SPY, QQQ, DIA, IWM and 11 sector ETFs, with dates.
- Market Pulse: AI briefing from live web search, every item cited with source and date, refreshed about every 3 hours.
- Company research: 5 fiscal years of revenue, growth, margins, EPS, cash flow, capex, free cash flow, cash, debt, equity, and valuation (P/E, P/S, FCF yield) from SEC filings plus Tiingo prices, with filing links.
- AI research assistant: answers from retrieved data only; facts (each cited), interpretation, risks, and missing data shown separately; no predictions or buy/sell; uncited facts removed automatically.
- Future Themes Lab: 6 themes, each with cited evidence, what has to go right, what could go wrong, and exposures with real risk metrics (research shortlists, not recommendations).
- Risk lab: volatility, max drawdown (with dates and an underwater chart), correlation matrix, concentration, each explained in one sentence.
- Screener: about 60 curated tickers, filterable and sortable.

---

## 3. Verified accuracy (automated tests)

- **Growth math vs. Excel FV:** e.g. `=FV(6%/12,360,-500)` = $502,257.52 exactly; 13 checks pass.
- **Time Machine accounting:** 34 checks on real data pass:
  - NVDA 2021 (4:1) and 2024 (10:1) and AAPL 2020 (4:1) splits leave position value unchanged.
  - Reinvested NVDA 2021–2024 and KO 2021–2023 match Tiingo's total return to the cent.
  - Cash + holdings = total after every transaction, and cash reconciles independently.
  - Invalid actions are blocked.
  - Alternates never modify the original.
  - The benchmark uses identical cash flows.

---

## 4. Known limits (say these plainly if asked)

- **Prices are end-of-day,** not real-time. Free Tiingo data is licensed for personal use, hence the passcode.
- **Tiingo's free plan allows 50 data requests per hour.** Data is cached for hours after the first load, but a burst of new tickers can show "waiting on the data limit." Open the main screens before a demo.
- **Simulations ignore taxes, fees, slippage, and interest on cash.** Dividends are credited on the ex-date (real payment comes later).
- **The screener covers about 60 curated tickers,** not the whole market. **Expense ratios aren't shown:** no verified free source.
- **Survivorship bias:** our data doesn't include delisted or bankrupt companies, so the tech-bubble basket uses survivors.
- **SEC data:** some companies (banks, insurers) don't report gross profit or revenue under standard tags; the page says so. Valuation uses the latest fiscal year, not trailing twelve months.
- **AI features** use the Anthropic API: answers are generated from cited sources but can still contain mistakes, which is why every item links to its source. The first Market Pulse or theme load takes 20–40 seconds; after that it's cached.
- **Saved scenarios and timelines live only in the browser** on that device.

---

## 5. My role (short, honest version)

> I had the idea and directed the build; AI (Claude, working in Claude Code) wrote all of the code. My job was the decisions an analyst would make: choosing the data sources and their limits, defining the accounting rules (how splits, dividends, and transaction timing should work, and that every portfolio must reconcile to the cent), deciding what the tools should and shouldn't say, especially no predictions and no buy/sell language, and testing the results against Excel and real market history. I also handled the accounts, keys, and deployment steps. The takeaway for me is that AI lets someone with an accounting background turn a financial idea into a working, checkable product, as long as the person directing it knows what "correct" looks like.

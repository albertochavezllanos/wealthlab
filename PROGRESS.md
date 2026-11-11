# WealthLab — Progress Log

Deadline: **7:00 a.m. Central, Nov 11, 2026.** Started 3:13 p.m. Central, Nov 10.

Full build brief: see the original instructions (stack, rules, three systems, design colors). Key rules:
never fabricate data; no fake buttons; keys only in `.env.local` and Vercel; end-of-day labelling;
"Educational prototype — not investment advice" everywhere; no Baird branding or implied affiliation.

## Project facts
- Next.js 16.4 (App Router, `cacheComponents` on, `src/` dir), React 19.3, Tailwind 4, Recharts, TypeScript.
- Next 16 renames middleware to **`src/proxy.ts`** (passcode gate lives there).
- Design tokens in `src/app/globals.css` (`navy`, `blue`, `copper`, `ivory`, `charcoal`, `slate`, ...).
  Fonts: Inter (body) + Source Serif 4 (headings, `font-serif`).
- Env vars: `DEMO_PASSCODE`, `TIINGO_API_KEY`, `ANTHROPIC_API_KEY`, `SEC_CONTACT_EMAIL`.

## Stage status
- [x] **Stage 1 — Foundation**: layout, header (with disclaimer strip) + mobile menu, footer, home page,
  passcode screen (`/access`, `/api/access`, `src/proxy.ts`), placeholder pages for Invest / Time Machine /
  Intelligence / Methodology (honest "in development" cards, no fake controls).
- [x] **Stage 2 — Invest** (`/invest`, tabs via `#research|simulator|waiting|compare|portfolio`):
  ticker search (Tiingo search + curated crypto list in `src/lib/server/tiingo.ts`), quote + split-adjusted
  chart + stats; growth simulator (`src/lib/growth.ts`, tested vs Excel FV: `npm test`); cost of waiting;
  strategy comparison; portfolio builder (monthly-rebalanced backtest vs SPY, vol/drawdown/correlation/
  concentration in `src/lib/metrics.ts`); browser-only saved scenarios + portfolios (`src/lib/client/storage.ts`).
  Data: `/api/history?ticker=` returns compact rows `[date, rawClose, adjClose, divCash, splitFactor]`,
  cached in memory 6h + CDN `s-maxage`. `/api/search?q=`.
- [x] **Stage 3 — Time Machine** (`/time-machine`, tabs `#build|covid|bubble`). Engine `src/lib/timemachine.ts`
  (raw closes + split factors + divCash; actions buy/sell/switch/deposit/withdraw/recurring; validation; ledger
  with per-entry balance check; cash reconciliation; SPY benchmark from executed cash flows, dividends reinvested).
  Tests: `scripts/test-timemachine.ts` (real Tiingo data: NVDA 2021/2024 + AAPL 2020 splits, KO dividends both
  modes, branch immutability, invalid-action blocking). UI: `src/components/tm/*` — Builder (timelines, copy as
  alternate, decisions editor, comparison chart with markers, holdings, ledger, browser-saved workspaces +
  autosave), ReplayCovid (decide on 2020-03-16, reveal), ReplayBubble (2000-03-10, QQQ/CSCO/INTC/AMZN/SPY).
  Methodology page fully written.
- [x] **Stage 4 — Intelligence core** (`/intelligence`, tabs `#markets|company|assistant|themes|risk|screener`):
  market overview (`/api/market?group=indexes|sectors`), company research from SEC EDGAR (`src/lib/server/sec.ts`,
  `/api/company`), AI research assistant (`src/lib/server/assistant.ts`, GET `/api/assistant?q=` — deterministic
  ticker detection, data packet with source IDs, ONE Claude call with JSON schema, uncited facts dropped),
  risk lab (vol, drawdown/underwater, correlation, concentration), screener of ~60 curated tickers
  (`src/lib/universe.ts`, `/api/screener`, partial results + "pending" when Tiingo rate-limits).
- [x] **Stage 5 — Market Pulse + Future Themes Lab**: `src/lib/server/webresearch.ts` (Claude + web search
  `web_search_20250305` — the 20260209 dynamic-filtering variant returned text WITHOUT citations, don't switch back),
  `/api/pulse` (CDN cache 3h), `/api/theme?id=` (+ `&part=market`), themes in `src/lib/themes.ts`.
- AI model: `claude-opus-5-5`, effort medium, server-side refusal fallback beta (`fallbacks: "default"`).
  Spend guard: 40 AI calls/hour/instance. Caching: in-memory `memo` + Vercel CDN `s-maxage` on GET routes.
- GOTCHAS: (1) every data API route must `await connection()` or Next prerenders it at BUILD time (this burned the
  Tiingo hourly limit once). (2) Don't use `"use cache"` around code that throws DataError — the error class is lost.
  (3) Tiingo free plan = 50 requests/hour, shared by local testing and production.
- [ ] Stage 6 — Testing and final deploy
- [ ] Stage 7 — Deliverables (feature list, demo script, role statement)

## Deployment
- GitHub: **https://github.com/albertochavezllanos/wealthlab** (private). Push with
  `& "C:\Program Files\Git\cmd\git.exe" push` (credentials cached by Git Credential Manager).
- Vercel: **https://wealthlab-theta.vercel.app** (project `wealthlab`, production). Deployed via CLI:
  read `VERCEL_TOKEN` from `.env.local` and run `npx vercel@latest deploy --prod --yes --token <token>`.
  Production env vars set (as Secrets): DEMO_PASSCODE, TIINGO_API_KEY, SEC_CONTACT_EMAIL.
  Add ANTHROPIC_API_KEY later with `vercel env add ANTHROPIC_API_KEY --environment production --value ... --yes --token ...`.

## Notes for the next session
- Git is at `C:\Program Files\Git\cmd\git.exe` (may not be on PATH in older shells).
- The user found Notepad editing confusing: give ONE step at a time. They replaced whole lines
  (dropping the `KEY=` labels); check `.env.local` structure with value-hiding scripts, never print values.
- `vercel link` appended VERCEL_OIDC_TOKEN to `.env.local` and junk to `.gitignore` (cleaned up).

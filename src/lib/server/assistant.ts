import "server-only";
import { FALLBACK_BETA, MODEL, aiError, anthropic, spendGuard } from "./ai";
import { companyReport, type CompanyReport } from "./company";
import { forget, memo } from "./memo";
import { consumeAiRequest, refundAiRequest } from "./quota";
import { secTitles } from "./sec";
import { getHistory, DataError } from "./tiingo";
import { snapshot, type Snapshot } from "@/lib/metrics";
import { KNOWN, SCREENER } from "@/lib/universe";

export interface Cited { text: string; sources: string[] }
export interface Source { id: string; label: string; url?: string; date?: string }
export interface AssistantAnswer {
  question: string;
  tickers: string[];
  summary: string;
  facts: Cited[];
  interpretation: Cited[];
  risks: Cited[];
  missingData: string[];
  sources: Source[];
  removedUncited: number;
  generatedAt: string;
  model: string;
  notice?: string;
  /** True if some data was temporarily unavailable (rate limits); such answers aren't cached */
  degraded: boolean;
}

// ---------- Finding companies in the question (no AI call needed) ----------

const ALIASES: Record<string, string> = {
  google: "GOOGL", alphabet: "GOOGL", facebook: "META", meta: "META", nvidia: "NVDA", microsoft: "MSFT", apple: "AAPL",
  amazon: "AMZN", tesla: "TSLA", netflix: "NFLX", disney: "DIS", berkshire: "BRK-B", "jp morgan": "JPM", jpmorgan: "JPM",
  "goldman sachs": "GS", goldman: "GS", "morgan stanley": "MS", "bank of america": "BAC", "wells fargo": "WFC", visa: "V",
  mastercard: "MA", blackrock: "BLK", walmart: "WMT", costco: "COST", "coca-cola": "KO", "coca cola": "KO", coke: "KO",
  pepsi: "PEP", pepsico: "PEP", "procter": "PG", "home depot": "HD", "mcdonald's": "MCD", mcdonalds: "MCD", nike: "NKE",
  starbucks: "SBUX", "unitedhealth": "UNH", "johnson & johnson": "JNJ", "johnson and johnson": "JNJ", "eli lilly": "LLY",
  lilly: "LLY", pfizer: "PFE", merck: "MRK", abbvie: "ABBV", "intuitive surgical": "ISRG", caterpillar: "CAT", boeing: "BA",
  honeywell: "HON", deere: "DE", "john deere": "DE", exxon: "XOM", "exxonmobil": "XOM", chevron: "CVX",
  nextera: "NEE", "duke energy": "DUK", linde: "LIN", prologis: "PLD", broadcom: "AVGO", oracle: "ORCL", salesforce: "CRM",
  adobe: "ADBE", amd: "AMD", "advanced micro devices": "AMD", intel: "INTC", cisco: "CSCO", ibm: "IBM", qualcomm: "QCOM",
  palantir: "PLTR", "general electric": "GE", "ge aerospace": "GE", uber: "UBER", "s&p 500": "SPY", "s&p": "SPY",
  "nasdaq": "QQQ", "taiwan semiconductor": "TSM", tsmc: "TSM", "berkshire hathaway": "BRK-B",
};
const NOT_TICKERS = new Set(["I", "A", "AI", "CEO", "CFO", "ETF", "US", "USA", "IT", "EPS", "PE", "P", "E", "FCF", "OK", "VS", "AND", "OR", "THE", "GDP", "IPO", "SEC", "FY", "TTM", "YOY", "EV", "R", "D", "ROE", "ROI", "API", "UK", "EU"]);

export async function findTickers(question: string): Promise<string[]> {
  const found: string[] = [];
  const add = (t: string) => { if (!found.includes(t)) found.push(t); };
  const lower = ` ${question.toLowerCase().replace(/[^\p{L}\p{N}&'\s.-]/gu, " ")} `;
  const aliasKeys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  const taken: [number, number][] = [];
  for (const k of aliasKeys) {
    const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}(?=[^a-z]|$)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const s = m.index + m[1].length, e = s + k.length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      found.push(`${s}:${ALIASES[k]}`);
    }
  }
  // Order by position in the question
  const ordered = found.sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0])).map((x) => x.split(":")[1]);
  found.length = 0;
  ordered.forEach(add);

  // Upper-case tickers typed directly, validated against the SEC list or our curated list
  const tokens = question.match(/\b[A-Z]{1,5}(?:[.-][A-Z])?\b/g) ?? [];
  const candidates = tokens.filter((t) => !NOT_TICKERS.has(t));
  if (candidates.length) {
    let titles: Record<string, unknown> = {};
    try { titles = await secTitles(); } catch {}
    for (const t of candidates) if (KNOWN[t] || titles[t]) add(t);
  }
  return found.slice(0, 4);
}

// ---------- Data packet ----------

const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? null : `${(n * 100).toFixed(d)}%`);
const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const a = Math.abs(n);
  const s = a >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toFixed(2);
  return `$${s}`;
};

interface Packet { sources: Source[]; data: Record<string, unknown>[]; missing: string[] }

async function buildPacket(tickers: string[]): Promise<Packet> {
  const sources: Source[] = [];
  const data: Record<string, unknown>[] = [];
  const missing: string[] = [];
  let n = 0;
  const addSource = (s: Omit<Source, "id">) => { const id = `S${++n}`; sources.push({ id, ...s }); return id; };

  for (const t of tickers) {
    let report: CompanyReport | null = null;
    let market: Snapshot | null = null;
    let secError: string | null = null;
    const isFund = KNOWN[t]?.assetType === "ETF";
    if (!isFund) {
      try { report = await companyReport(t); market = report.market; } catch (e) { secError = e instanceof Error ? e.message : "SEC data unavailable"; }
    }
    if (!market) {
      try { market = snapshot(await getHistory(t)); } catch (e) { missing.push(`${t}: market data unavailable (${e instanceof Error ? e.message : "error"})`); }
    }
    if (secError) missing.push(`${t}: SEC financials unavailable (${secError})`);

    const entry: Record<string, unknown> = { ticker: t, name: report?.company.name ?? market?.name ?? KNOWN[t]?.name ?? t };
    if (market) {
      const sid = addSource({ label: `Tiingo end-of-day prices for ${t}, through ${market.date}`, date: market.date });
      entry.market_data = {
        source: sid,
        price_close: `$${market.close.toFixed(2)} on ${market.date} (end-of-day)`,
        total_return_1y: pct(market.r1y),
        annualized_return_5y: pct(market.cagr5y),
        volatility_1y_annualized: pct(market.vol1y),
        max_drawdown_5y: market.mdd5y !== null ? `${pct(market.mdd5y)} (peak ${market.mdd5yPeak} to low ${market.mdd5yTrough})` : null,
        dividend_yield_trailing_12m: pct(market.divYield, 2),
        below_52_week_high: pct(market.fromHigh),
      };
    }
    if (report && report.company.years.length) {
      const c = report.company;
      const latest = c.years.at(-1)!;
      const sid = addSource({ label: `${c.name} annual report (${latest.source?.form ?? "10-K"}, fiscal year ended ${latest.end}), SEC EDGAR`, url: latest.source?.url, date: latest.source?.filed });
      const allId = addSource({ label: `${c.name} financial data across fiscal years, SEC EDGAR XBRL company facts`, url: c.filingsUrl, date: c.fetchedAt.slice(0, 10) });
      entry.financials = {
        sources: [sid, allId],
        note: "Fiscal-year figures in USD as reported in 10-K filings. Margins and growth are calculated from these figures.",
        fiscal_years: c.years.slice(-3).map((y, k, arr) => {
          const prev = k > 0 ? arr[k - 1] : c.years[c.years.indexOf(y) - 1];
          return {
            fiscal_year_end: y.end,
            revenue: money(y.revenue),
            revenue_growth_yoy: prev?.revenue && y.revenue ? pct(y.revenue / prev.revenue - 1) : null,
            gross_margin: y.revenue && y.grossProfit !== null ? pct(y.grossProfit / y.revenue) : null,
            operating_margin: y.revenue && y.operatingIncome !== null ? pct(y.operatingIncome / y.revenue) : null,
            net_income: money(y.netIncome),
            net_margin: y.revenue && y.netIncome !== null ? pct(y.netIncome / y.revenue) : null,
            diluted_eps: y.epsDiluted !== null ? `$${y.epsDiluted.toFixed(2)}` : null,
            operating_cash_flow: money(y.operatingCashFlow),
            capital_expenditures: money(y.capex),
            free_cash_flow: money(y.freeCashFlow),
            cash: money(y.cash),
            long_term_debt: money(y.debt),
            shareholders_equity: money(y.equity),
          };
        }),
        data_gaps: c.notes,
      };
      if (report.valuation) {
        const v = report.valuation;
        entry.valuation = {
          sources: [entry.market_data ? (entry.market_data as { source: string }).source : null, sid].filter(Boolean),
          note: `Calculated: price on ${v.priceDate} with shares outstanding reported as of ${v.sharesDate ?? "n/a"} and fiscal-year figures for the year ended ${v.basisYear ?? "n/a"}. Not trailing-twelve-month.`,
          market_cap: money(v.marketCap),
          price_to_earnings: v.pe !== null ? v.pe.toFixed(1) : null,
          price_to_sales: v.ps !== null ? v.ps.toFixed(1) : null,
          free_cash_flow_yield: pct(v.fcfYield),
        };
      }
    }
    if (isFund) entry.note = "This is a fund (ETF); company financial statements don't apply.";
    data.push(entry);
  }
  return { sources, data, missing };
}

// ---------- The single AI call ----------

const SYSTEM = `You are WealthLab's research assistant inside an educational prototype. You help a user understand companies using ONLY the data packet provided in the user message.

Rules:
- Use only the provided data. Do not add facts, numbers, news, or dates from memory. If something the user asks about isn't in the data, say so in missing_data.
- Every item in "facts" must be a factual statement taken from the data, with the source IDs (like "S1") it came from in "sources". Do not include a fact you cannot attribute to a provided source ID.
- "interpretation" holds your analysis of what the facts suggest (comparisons, trade-offs, what stands out). Cite the source IDs the reasoning relies on. Keep it clearly separate from facts.
- "risks" lists the main risks and uncertainties visible in the data (valuation, volatility, drawdowns, debt, concentration, slowing growth, data limits). Cite sources where a number is involved.
- Never predict future prices or returns, never give price targets, and never say or imply "buy", "sell", or "hold". If the user asks for that, briefly say in the summary that WealthLab doesn't make recommendations or predictions, then provide the factual comparison instead.
- Prices are end-of-day, not real-time. Fiscal-year figures may be up to a year old; mention timing where it matters.
- Be concise and plain-English for a non-expert: summary of 2 to 3 sentences; about 4 to 8 facts; 2 to 4 interpretation points; 2 to 4 risks. Write numbers exactly as given.`;

const CITED = {
  type: "object",
  additionalProperties: false,
  required: ["text", "sources"],
  properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "facts", "interpretation", "risks", "missing_data"],
  properties: {
    summary: { type: "string" },
    facts: { type: "array", items: CITED },
    interpretation: { type: "array", items: CITED },
    risks: { type: "array", items: CITED },
    missing_data: { type: "array", items: { type: "string" } },
  },
};

const ADVICE = /\b(should i (buy|sell|invest)|is it a (good )?buy|price target|will .{0,40}\b(go up|go down|rise|fall|crash|reach)\b|what will .{0,30} be worth|predict)/i;

async function generate(question: string, tickers: string[], visitor: string): Promise<AssistantAnswer> {
  const packet = await buildPacket(tickers);
  if (!packet.data.some((d) => d.market_data || d.financials)) {
    throw new DataError("Couldn't retrieve data for those companies right now, so no AI answer was generated.", "upstream", 502);
  }
  await consumeAiRequest(visitor);
  const user = `Data packet (JSON):\n${JSON.stringify({ retrieved_at: new Date().toISOString().slice(0, 10), companies: packet.data, retrieval_gaps: packet.missing })}\n\nSource list:\n${packet.sources.map((s) => `${s.id}: ${s.label}`).join("\n")}\n\nUser question: ${question}`;

  let text = "";
  try {
    spendGuard();
    const res = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") throw new DataError("The AI declined to answer this question.", "upstream", 502);
    for (const b of res.content) if (b.type === "text") text += b.text;
  } catch (e) {
    await refundAiRequest(visitor); // the AI call failed on our side: don't charge the visitor
    throw aiError(e);
  }

  let parsed: { summary: string; facts: Cited[]; interpretation: Cited[]; risks: Cited[]; missing_data: string[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DataError("The AI returned an unreadable answer. Please try again.", "upstream", 502);
  }

  // Enforce citations: keep only real source IDs; drop facts with none
  const valid = new Set(packet.sources.map((s) => s.id));
  const clean = (list: Cited[]) => list.map((c) => ({ text: c.text, sources: [...new Set(c.sources.filter((s) => valid.has(s)))] }));
  const facts = clean(parsed.facts);
  const kept = facts.filter((f) => f.sources.length > 0);

  return {
    question,
    tickers,
    summary: parsed.summary,
    facts: kept,
    interpretation: clean(parsed.interpretation),
    risks: clean(parsed.risks),
    missingData: [...new Set([...packet.missing, ...parsed.missing_data])],
    sources: packet.sources,
    removedUncited: facts.length - kept.length,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    notice: ADVICE.test(question) ? "WealthLab doesn't make predictions or buy/sell recommendations. This answer covers the facts and trade-offs instead." : undefined,
    degraded: packet.missing.some((m) => /limit|try again|couldn't reach|busy/i.test(m)),
  };
}

export async function ask(rawQuestion: string, visitor: string): Promise<AssistantAnswer | { needTickers: true; message: string }> {
  const question = rawQuestion.trim().replace(/\s+/g, " ").slice(0, 400);
  if (question.length < 3) throw new DataError("Please type a question.", "bad_request", 400);
  const tickers = await findTickers(question);
  if (tickers.length === 0) {
    return { needTickers: true, message: "Please name 1 to 4 companies or tickers, for example: \"Compare Nvidia, Microsoft, and Apple.\" The assistant answers from retrieved data, so it needs to know which companies to look up." };
  }
  const key = `ask:${question.toLowerCase()}|${tickers.join(",")}`;
  // In-memory cache here + CDN cache on the route: the same question never triggers a second AI call while cached
  // Only a cache miss runs the AI, so only a cache miss counts toward the visitor's daily limit
  const answer = await memo(key, 12 * 3600 * 1000, () => generate(question, tickers, visitor));
  // Don't keep answers produced while some data was temporarily unavailable
  if (answer.degraded) forget(key);
  return answer;
}

export const EXAMPLE_QUESTIONS = [
  "Compare Nvidia, Microsoft, and Apple",
  "How do Visa and Mastercard differ in growth and margins?",
  "What are the main risks for Tesla based on its numbers?",
  "Compare JPMorgan and Bank of America",
];
export const SCREENER_TICKERS = SCREENER.map((s) => s.ticker);

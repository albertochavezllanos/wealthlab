// Save end-of-day price history for every built-in investment to data/eod/<TICKER>.json.
// Run: node scripts/snapshot.ts   (paces itself around Tiingo's 50-requests/hour limit; safe to re-run)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { KNOWN } from "../src/lib/universe.ts";

type Row = [string, number, number, number, number];
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const OUT = new URL("../data/eod/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const CRYPTO: Record<string, string> = {
  BTCUSD: "Bitcoin (USD)", ETHUSD: "Ethereum (USD)", SOLUSD: "Solana (USD)", XRPUSD: "XRP (USD)",
  ADAUSD: "Cardano (USD)", DOGEUSD: "Dogecoin (USD)", LTCUSD: "Litecoin (USD)",
};
// Demo-critical first, then everything else we know by name
const FIRST = ["SPY", "QQQ", "AAPL", "NVDA", "MSFT", "CSCO", "INTC", "AMZN", "VTI", "VXUS", "BND", "DIA", "IWM", "KO", "VOO", "VFIAX", "BTCUSD", "JPM", "TSLA"];
const ALL = [...new Set([...FIRST, ...Object.keys(KNOWN), ...Object.keys(CRYPTO)])];
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

async function get(url: string): Promise<unknown> {
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Token ${env.TIINGO_API_KEY}` } });
    const text = await res.text();
    if (res.status === 429 || /run over your|request allocation/i.test(text)) {
      console.log(`${new Date().toLocaleTimeString()} rate-limited; waiting 4 minutes`);
      await sleep(240_000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 120)}`);
    return JSON.parse(text);
  }
}

let done = 0;
for (const t of ALL) {
  const file = new URL(`${t}.json`, OUT);
  if (existsSync(file)) {
    const prev = JSON.parse(readFileSync(file, "utf8"));
    if (prev.fetchedAt?.slice(0, 10) === today) { done++; continue; } // already saved today
  }
  try {
    const isCrypto = t in CRYPTO;
    let rows: Row[];
    if (isCrypto) {
      const d = (await get(`https://api.tiingo.com/tiingo/crypto/prices?tickers=${t.toLowerCase()}&startDate=2014-01-01&resampleFreq=1day`)) as { priceData: { date: string; close: number }[] }[];
      rows = (d[0]?.priceData ?? []).filter((p) => p.close > 0).map((p) => [p.date.slice(0, 10), round(p.close), round(p.close), 0, 1]);
    } else {
      const d = (await get(`https://api.tiingo.com/tiingo/daily/${t}/prices?startDate=1990-01-01`)) as { date: string; close: number; adjClose: number; divCash: number; splitFactor: number }[];
      rows = d.filter((x) => x.close > 0).map((x) => [x.date.slice(0, 10), round(x.close), round(x.adjClose), round(x.divCash || 0), x.splitFactor || 1]);
    }
    if (!rows.length) throw new Error("no rows");
    const k = KNOWN[t];
    const history = {
      ticker: t,
      name: isCrypto ? CRYPTO[t] : k.name,
      assetType: isCrypto ? "Crypto" : k.assetType,
      source: isCrypto ? "Tiingo crypto, daily close (UTC day)" : "Tiingo end-of-day (official close)",
      fetchedAt: new Date().toISOString(),
      firstDate: rows[0][0],
      lastDate: rows[rows.length - 1][0],
      rows,
    };
    writeFileSync(file, JSON.stringify(history));
    done++;
    console.log(`${new Date().toLocaleTimeString()} saved ${t} (${rows.length} days, through ${history.lastDate})  [${done}/${ALL.length}]`);
  } catch (e) {
    console.log(`${new Date().toLocaleTimeString()} FAILED ${t}: ${(e as Error).message}`);
  }
}
console.log(`DONE: ${done}/${ALL.length} saved`);

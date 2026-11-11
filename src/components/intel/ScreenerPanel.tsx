"use client";

import { useMemo, useState } from "react";
import { Button, Notice, NumberField, Spinner } from "@/components/form";
import { Card } from "@/components/ui";
import { useJson } from "@/lib/client/data";
import { fmtDate, pct, price } from "@/lib/format";
import type { Snapshot } from "@/lib/metrics";
import { SCREENER } from "@/lib/universe";
import { Chg, Sparkline } from "./shared";
import { BatchNotice } from "./MarketsPanel";

interface Batch { rows: Snapshot[]; pending: string[]; failed: { ticker: string; error: string }[]; rateLimited: boolean }
type SortKey = "ticker" | "close" | "ytd" | "r1y" | "cagr5y" | "vol1y" | "mdd5y" | "divYield" | "fromHigh";

const SECTOR = Object.fromEntries(SCREENER.map((s) => [s.ticker, s.sector ?? ""]));
const SECTORS = ["All", ...new Set(SCREENER.map((s) => s.sector ?? ""))];

export function ScreenerPanel() {
  const r = useJson<Batch>("/api/screener");
  const [sector, setSector] = useState("All");
  const [minR1y, setMinR1y] = useState(-100);
  const [maxVol, setMaxVol] = useState(200);
  const [minYield, setMinYield] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "r1y", dir: -1 });

  const rows = useMemo(() => {
    if (r.status !== "ready") return [];
    return r.data.rows
      .filter((x) => sector === "All" || SECTOR[x.ticker] === sector)
      .filter((x) => (x.r1y ?? -Infinity) * 100 >= minR1y || minR1y <= -100)
      .filter((x) => (x.vol1y ?? 0) * 100 <= maxVol)
      .filter((x) => (x.divYield ?? 0) * 100 >= minYield)
      .sort((a, b) => {
        if (sort.key === "ticker") return a.ticker.localeCompare(b.ticker) * sort.dir;
        const va = a[sort.key] as number | null, vb = b[sort.key] as number | null;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (va - vb) * sort.dir;
      });
  }, [r, sector, minR1y, maxVol, minYield, sort]);

  const Th = ({ k, children, left }: { k: SortKey; children: React.ReactNode; left?: boolean }) => (
    <th className={`py-2 ${left ? "text-left" : "pl-3"}`}>
      <button type="button" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : -1 }))} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy ${sort.key === k ? "text-navy" : ""}`}>
        {children}{sort.key === k && <span>{sort.dir === -1 ? "↓" : "↑"}</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-serif text-xl text-navy">Screener</h2>
        <p className="mt-1 text-sm text-muted">
          A curated list of {SCREENER.length} well-known U.S. stocks and ETFs. The free data plan can&rsquo;t cover the whole market, so this is not a full-market screen.
          ETF and fund expense ratios aren&rsquo;t shown: we didn&rsquo;t find a verified free source for them.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-charcoal">Sector</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full rounded-xl border border-slate-line bg-white px-3 py-2.5 text-base outline-none focus:border-blue">
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <NumberField label="Min 1-yr return" value={minR1y} onChange={setMinR1y} min={-100} max={500} step={5} suffix="%" />
          <NumberField label="Max volatility" value={maxVol} onChange={setMaxVol} min={0} max={200} step={5} suffix="%" />
          <NumberField label="Min dividend yield" value={minYield} onChange={setMinYield} min={0} max={20} step={0.5} suffix="%" />
        </div>
      </Card>

      {r.status === "loading" && <Card className="flex h-60 items-center justify-center"><Spinner label="Loading the screener list" /></Card>}
      {r.status === "error" && <Notice tone="error">{r.error}</Notice>}
      {r.status === "ready" && (
        <Card className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{rows.length} of {r.data.rows.length} shown{r.data.rows[0] && ` · end-of-day data as of ${fmtDate(r.data.rows[0].date)}`}</p>
            {r.data.pending.length > 0 && <Button size="sm" variant="secondary" onClick={r.reload}>Load remaining</Button>}
          </div>
          <BatchNotice b={r.data} what="investments" />
          <div className="mt-3 overflow-x-auto">
            <table className="num w-full min-w-[920px] text-right text-sm">
              <thead className="text-[11px] text-muted">
                <tr>
                  <Th k="ticker" left>Investment</Th><th className="py-2 pl-3 text-left uppercase tracking-wide">Sector</th>
                  <Th k="close">Price</Th><Th k="ytd">YTD</Th><Th k="r1y">1-yr return</Th><Th k="cagr5y">5-yr / yr</Th>
                  <Th k="vol1y">Volatility</Th><Th k="mdd5y">Max drawdown</Th><Th k="divYield">Div. yield</Th><Th k="fromHigh">From high</Th>
                  <th className="py-2 pl-3 uppercase tracking-wide">1 yr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.ticker} className="border-t border-slate">
                    <td className="py-2 text-left"><span className="font-semibold text-navy">{x.ticker}</span><span className="ml-2 text-xs text-muted">{x.name}</span></td>
                    <td className="py-2 pl-3 text-left text-xs text-muted">{SECTOR[x.ticker]}</td>
                    <td className="py-2 pl-3">{price(x.close)}</td>
                    <td className="py-2 pl-3"><Chg v={x.ytd} /></td>
                    <td className="py-2 pl-3"><Chg v={x.r1y} /></td>
                    <td className="py-2 pl-3"><Chg v={x.cagr5y} /></td>
                    <td className="py-2 pl-3">{pct(x.vol1y ?? NaN, 0)}</td>
                    <td className="py-2 pl-3 text-negative">{pct(x.mdd5y ?? NaN, 0)}</td>
                    <td className="py-2 pl-3">{x.divYield ? pct(x.divYield, 2) : "—"}</td>
                    <td className="py-2 pl-3">{pct(x.fromHigh ?? NaN, 0)}</td>
                    <td className="py-2 pl-3"><Sparkline values={x.spark} width={72} height={22} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Returns include dividends (total return). 5-yr / yr is the annualized return. Max drawdown covers the last 5 years. Source: Tiingo end-of-day. Not a recommendation list.</p>
        </Card>
      )}
    </div>
  );
}

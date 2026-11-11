"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TickerSearch } from "@/components/TickerSearch";
import { Notice, Spinner, Stat } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps } from "@/components/charts/theme";
import { useJson } from "@/lib/client/data";
import { compactUsd, fmtDate, fmtDateTime, num, pct, price } from "@/lib/format";
import type { Snapshot } from "@/lib/metrics";
import { Chg } from "./shared";

interface SourceRef { form: string; filed: string; accn: string; url: string }
interface FYRow {
  end: string; revenue: number | null; grossProfit: number | null; operatingIncome: number | null; netIncome: number | null;
  epsDiluted: number | null; operatingCashFlow: number | null; capex: number | null; freeCashFlow: number | null;
  cash: number | null; debt: number | null; equity: number | null; source: SourceRef | null;
}
interface Report {
  company: { cik: number; name: string; ticker: string; years: FYRow[]; sharesOutstanding: { value: number; date: string; source: SourceRef } | null; filingsUrl: string; fetchedAt: string; notes: string[] };
  market: Snapshot | null;
  marketError: string | null;
  valuation: { price: number; priceDate: string; marketCap: number | null; pe: number | null; ps: number | null; fcfYield: number | null; basisYear: string | null; sharesDate: string | null } | null;
}

const QUICK = ["AAPL", "MSFT", "NVDA", "JPM", "KO", "TSLA"];
const m = (v: number | null) => (v === null ? "—" : compactUsd(v));
const ratio = (a: number | null, b: number | null) => (a !== null && b ? a / b : null);

export function CompanyPanel() {
  const [ticker, setTicker] = useState("AAPL");
  const r = useJson<Report>(`/api/company?ticker=${encodeURIComponent(ticker)}`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <TickerSearch onSelect={(x) => setTicker(x.ticker)} placeholder="Search a U.S.-listed company (e.g. Apple, JPMorgan, Coca-Cola)" />
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((t) => (
            <button key={t} type="button" onClick={() => setTicker(t)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${t === ticker ? "border-navy bg-navy text-white" : "border-slate-line bg-white text-navy hover:border-navy/40"}`}>{t}</button>
          ))}
        </div>
      </div>

      {r.status === "loading" && <Card className="flex h-72 items-center justify-center"><Spinner label={`Loading ${ticker} filings from SEC EDGAR`} /></Card>}
      {r.status === "error" && <Notice tone="error"><strong>{ticker}:</strong> {r.error}</Notice>}
      {r.status === "ready" && <ReportView d={r.data} />}
    </div>
  );
}

function ReportView({ d }: { d: Report }) {
  const c = d.company;
  const ys = c.years;
  const last = ys.at(-1);
  const prev = ys.at(-2);
  const first = ys[0];
  const cagr = first?.revenue && last?.revenue && ys.length > 1 ? Math.pow(last.revenue / first.revenue, 1 / (ys.length - 1)) - 1 : null;
  const chart = ys.map((y) => ({ fy: `FY${y.end.slice(0, 4)}`, end: y.end, revenue: y.revenue, netIncome: y.netIncome, fcf: y.freeCashFlow }));

  const rows: { label: string; get: (y: FYRow, i: number) => string; hint?: string }[] = [
    { label: "Revenue", get: (y) => m(y.revenue) },
    { label: "Revenue growth", get: (y, i) => (i > 0 && ys[i - 1].revenue && y.revenue ? pct(y.revenue / ys[i - 1].revenue! - 1, 1, true) : "—") },
    { label: "Gross margin", get: (y) => pct(ratio(y.grossProfit, y.revenue) ?? NaN) },
    { label: "Operating margin", get: (y) => pct(ratio(y.operatingIncome, y.revenue) ?? NaN) },
    { label: "Net income", get: (y) => m(y.netIncome) },
    { label: "Net margin", get: (y) => pct(ratio(y.netIncome, y.revenue) ?? NaN) },
    { label: "Diluted EPS", get: (y) => (y.epsDiluted !== null ? price(y.epsDiluted) : "—") },
    { label: "Operating cash flow", get: (y) => m(y.operatingCashFlow) },
    { label: "Capital expenditures", get: (y) => m(y.capex) },
    { label: "Free cash flow", get: (y) => m(y.freeCashFlow), hint: "Operating cash flow minus capital expenditures" },
    { label: "Cash", get: (y) => m(y.cash) },
    { label: "Long-term debt", get: (y) => m(y.debt) },
    { label: "Shareholders' equity", get: (y) => m(y.equity) },
    { label: "Debt / equity", get: (y) => (y.debt !== null && y.equity && y.equity > 0 ? num(y.debt / y.equity, 2) : "—") },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl text-navy">{c.name}</h2>
              <Badge tone="navy">{c.ticker}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">SEC CIK {c.cik} · annual figures from 10-K filings</p>
          </div>
          {d.market ? (
            <div className="text-right">
              <p className="num font-serif text-3xl text-navy">{price(d.market.close)}</p>
              <p className="text-xs text-muted">End-of-day close {fmtDate(d.market.date)} · 1Y total return <Chg v={d.market.r1y} /></p>
            </div>
          ) : (
            <p className="max-w-xs text-right text-xs text-muted">Price unavailable right now: {d.marketError}</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`Revenue FY${last?.end.slice(0, 4) ?? ""}`} value={last ? m(last.revenue) : "—"} sub={prev?.revenue && last?.revenue ? `${pct(last.revenue / prev.revenue - 1, 1, true)} vs prior year` : "Growth unavailable"} />
          <Stat label="Net margin" value={last ? pct(ratio(last.netIncome, last.revenue) ?? NaN) : "—"} sub={`Net income ${last ? m(last.netIncome) : "—"}`} />
          <Stat label={`Revenue growth / yr`} value={cagr !== null ? pct(cagr) : "—"} sub={ys.length > 1 ? `Compound, FY${first.end.slice(0, 4)}–FY${last!.end.slice(0, 4)}` : "Needs 2+ years"} />
          <Stat label="Free cash flow" value={last ? m(last.freeCashFlow) : "—"} sub="Operating cash flow − capex" />
        </div>

        {d.valuation && (
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Market value" value={m(d.valuation.marketCap)} sub={d.valuation.sharesDate ? `Price × shares reported ${fmtDate(d.valuation.sharesDate)}` : "Shares outstanding not reported"} />
            <Stat label="Price / earnings" value={d.valuation.pe !== null ? num(d.valuation.pe, 1) : "—"} sub={d.valuation.pe !== null ? `vs FY${d.valuation.basisYear?.slice(0, 4)} diluted EPS` : "Not meaningful (no positive EPS)"} />
            <Stat label="Price / sales" value={d.valuation.ps !== null ? num(d.valuation.ps, 1) : "—"} sub={`vs FY${d.valuation.basisYear?.slice(0, 4) ?? ""} revenue`} />
            <Stat label="Free cash flow yield" value={d.valuation.fcfYield !== null ? pct(d.valuation.fcfYield) : "—"} sub="FCF ÷ market value" />
          </div>
        )}
        {d.valuation && <p className="mt-2 text-xs text-muted">Valuation uses the {fmtDate(d.valuation.priceDate)} close with the latest fiscal-year results, not trailing twelve months, so it can lag recent quarters.</p>}
      </Card>

      {chart.length > 0 && (
        <Card>
          <h3 className="font-serif text-lg text-navy">Revenue, net income, and free cash flow</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="fy" {...axisProps} />
                <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactUsd(v)} />
                <Tooltip cursor={{ fill: "rgba(36,99,154,0.06)" }} content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={`Fiscal year ended ${fmtDate(String(payload[0].payload.end))}`} rows={payload.map((p) => ({ label: String(p.name), value: m(p.value as number | null), color: String(p.color) }))} /> : null)} />
                <RLegend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill={C.navy} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="netIncome" name="Net income" fill={C.copper} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="fcf" name="Free cash flow" fill={C.blue} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-serif text-lg text-navy">Financial summary</h3>
        {ys.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No annual financial statements were found in SEC&rsquo;s standard data for this company.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="num w-full min-w-[640px] text-right text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 text-left">Fiscal year ended</th>{ys.map((y) => <th key={y.end} className="py-2 pl-3">{fmtDate(y.end)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-slate">
                    <td className="py-2 text-left text-charcoal" title={row.hint}>{row.label}</td>
                    {ys.map((y, i) => <td key={y.end} className="py-2 pl-3">{row.get(y, i)}</td>)}
                  </tr>
                ))}
                <tr className="border-t border-slate">
                  <td className="py-2 text-left text-muted">Source filing</td>
                  {ys.map((y) => <td key={y.end} className="py-2 pl-3 text-xs">{y.source ? <a href={y.source.url} target="_blank" rel="noopener noreferrer" className="text-blue underline underline-offset-2">{y.source.form}, filed {fmtDate(y.source.filed)}</a> : "—"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {c.notes.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {c.notes.map((n) => <li key={n}>• {n}</li>)}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Sources: SEC EDGAR XBRL company facts (<a className="text-blue underline" href={c.filingsUrl} target="_blank" rel="noopener noreferrer">all {c.name} filings</a>), retrieved {fmtDateTime(c.fetchedAt)}.
          Figures are as reported in annual 10-K filings (later restatements replace earlier numbers). Prices: Tiingo end-of-day. Margins, growth, and ratios are WealthLab calculations from these figures.
        </p>
      </Card>
    </div>
  );
}

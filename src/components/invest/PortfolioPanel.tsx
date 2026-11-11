"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TickerSearch } from "@/components/TickerSearch";
import { Button, Notice, NumberField, Segmented, Spinner, Stat } from "@/components/form";
import { Card } from "@/components/ui";
import { C, Legend, TooltipCard, axisProps, dateTicks, downsample } from "@/components/charts/theme";
import { useHistories } from "@/lib/client/data";
import { deleteSaved, listSaved, newId, upsertSaved, type Saved } from "@/lib/client/storage";
import { compactUsd, fmtDate, num, pct, usd } from "@/lib/format";
import {
  alignTotalReturn,
  backtestPortfolio,
  concentration,
  correlation,
  rangeStart,
  simpleReturns,
  summarize,
  type RangeKey,
} from "@/lib/metrics";

interface Holding {
  ticker: string;
  weight: number;
}
const PORTFOLIO_KEY = "wealthlab.portfolios.v1";
const DEFAULT_HOLDINGS: Holding[] = [
  { ticker: "VTI", weight: 60 },
  { ticker: "VXUS", weight: 20 },
  { ticker: "BND", weight: 20 },
];
const PERIODS: RangeKey[] = ["1Y", "3Y", "5Y", "10Y", "MAX"];
const BENCH = "SPY";

export function PortfolioPanel() {
  const [holdings, setHoldings] = useState<Holding[]>(DEFAULT_HOLDINGS);
  const [period, setPeriod] = useState<RangeKey>("5Y");
  const [initial, setInitial] = useState(10000);
  const [saved, setSaved] = useState<Saved<Holding[]>[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setSaved(listSaved<Holding[]>(PORTFOLIO_KEY)), []);

  const tickers = useMemo(() => [...new Set([...holdings.map((h) => h.ticker), BENCH])], [holdings]);
  const { loading, data, errors } = useHistories(tickers);
  const totalWeight = holdings.reduce((s, h) => s + (h.weight || 0), 0);
  const weightsOk = Math.abs(totalWeight - 100) < 0.01;

  const analysis = useMemo(() => {
    if (loading || holdings.length === 0 || !weightsOk) return null;
    if (holdings.some((h) => !data[h.ticker]) || !data[BENCH]) return null;
    const hs = holdings.map((h) => data[h.ticker]);
    const latest = hs.map((h) => h.lastDate).sort()[0];
    const requested = rangeStart(latest, period);
    const youngest = [...hs.map((h) => h.firstDate), data[BENCH].firstDate].sort().reverse()[0];
    const start = requested > youngest ? requested : youngest;
    const { dates, series } = alignTotalReturn([...hs, data[BENCH]], start);
    if (dates.length < 20) return { error: "Not enough overlapping trading history for these investments in this period." } as const;
    const port = backtestPortfolio(dates, series.slice(0, hs.length), holdings.map((h) => h.weight), initial);
    const bench = series[hs.length].map((v) => (v / series[hs.length][0]) * initial);
    const perYear = 252;
    const ps = summarize(port, dates, perYear);
    const bs = summarize(bench, dates, perYear);
    const each = hs.map((h, k) => ({ ticker: h.ticker, name: h.name, ...summarize(series[k], dates, perYear) }));
    const rets = series.slice(0, hs.length).map((s) => simpleReturns(s));
    const corr = rets.map((a) => rets.map((b) => correlation(a, b)));
    const chart = downsample(dates.map((d, i) => ({ date: d, port: port[i], bench: bench[i] })), 600);
    const axis = dateTicks(chart.map((p) => p.date));
    return {
      dates, port, bench, ps, bs, each, corr, chart, axis,
      shortened: start > requested && period !== "MAX",
      start,
      conc: concentration(holdings.map((h) => h.weight)),
    };
  }, [loading, holdings, data, period, initial, weightsOk]);

  function addTicker(t: string) {
    if (holdings.some((h) => h.ticker === t) || holdings.length >= 8) return;
    setHoldings((hs) => [...hs, { ticker: t, weight: 0 }]);
  }
  function normalize() {
    if (totalWeight <= 0) return;
    const scaled = holdings.map((h) => ({ ...h, weight: Math.round((h.weight / totalWeight) * 1000) / 10 }));
    const diff = Math.round((100 - scaled.reduce((s, h) => s + h.weight, 0)) * 10) / 10;
    scaled[0].weight = Math.round((scaled[0].weight + diff) * 10) / 10;
    setHoldings(scaled);
  }
  function save() {
    const nm = name.trim() || `Portfolio ${saved.length + 1}`;
    const existing = saved.find((s) => s.name === nm);
    const ok = upsertSaved(PORTFOLIO_KEY, { id: existing?.id ?? newId(), name: nm, savedAt: new Date().toISOString(), data: holdings });
    setMsg(ok ? `Saved "${nm}" in this browser.` : "Your browser blocked saving.");
    setSaved(listSaved(PORTFOLIO_KEY));
  }

  const failed = Object.entries(errors);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <h2 className="font-serif text-xl text-navy">Build a portfolio</h2>
          <p className="mt-1 text-sm text-muted">Add up to 8 investments and set target weights. We test it on real history, rebalanced monthly.</p>
          <div className="mt-4">
            <TickerSearch compact onSelect={(r) => addTicker(r.ticker)} placeholder="Add an investment (e.g. QQQ, MSFT, BTCUSD)" />
          </div>
          <ul className="mt-4 space-y-2">
            {holdings.map((h, i) => (
              <li key={h.ticker} className="flex items-center gap-2 rounded-xl border border-slate-line/80 bg-ivory/60 px-3 py-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: C.series[i % C.series.length] }} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{h.ticker}</p>
                  <p className="truncate text-xs text-muted">{data[h.ticker]?.name ?? (errors[h.ticker] ? "Unavailable" : "Loading…")}</p>
                </div>
                <div className="w-28">
                  <NumberField label="" ariaLabel={`${h.ticker} weight`} value={h.weight} onChange={(v) => setHoldings((hs) => hs.map((x, k) => (k === i ? { ...x, weight: v } : x)))} min={0} max={100} step={5} suffix="%" />
                </div>
                <button type="button" aria-label={`Remove ${h.ticker}`} onClick={() => setHoldings((hs) => hs.filter((_, k) => k !== i))} className="rounded-full px-2 text-lg text-muted hover:bg-slate hover:text-negative">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className={weightsOk ? "text-muted" : "font-semibold text-negative"}>Total: {num(totalWeight, 1)}%</span>
            {!weightsOk && totalWeight > 0 && <Button size="sm" variant="secondary" onClick={normalize}>Scale to 100%</Button>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <NumberField label="Starting amount" prefix="$" value={initial} onChange={setInitial} min={100} step={1000} />
          </div>

          <div className="mt-6 border-t border-slate pt-4">
            <p className="text-sm font-medium text-charcoal">Saved portfolios <span className="font-normal text-muted">(this browser only)</span></p>
            <div className="mt-2 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this portfolio" aria-label="Portfolio name" maxLength={60} className="min-w-0 flex-1 rounded-xl border border-slate-line bg-white px-3 py-2 text-sm outline-none focus:border-blue" />
              <Button size="sm" onClick={save} disabled={holdings.length === 0}>Save</Button>
            </div>
            {msg && <p className="mt-2 text-xs text-positive">{msg}</p>}
            {saved.length > 0 && (
              <ul className="mt-3 divide-y divide-slate">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted">{s.data.map((h) => `${h.ticker} ${h.weight}%`).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="secondary" onClick={() => { setHoldings(s.data); setName(s.name); setMsg(`Loaded "${s.name}".`); }}>Load</Button>
                      <Button size="sm" variant="danger" onClick={() => { deleteSaved(PORTFOLIO_KEY, s.id); setSaved(listSaved(PORTFOLIO_KEY)); }}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-navy">How it would have done</h2>
              <p className="text-xs text-muted">Real total returns (dividends reinvested) vs. simply holding SPY. Past results don&rsquo;t predict future returns.</p>
            </div>
            <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
          </div>

          {failed.length > 0 && (
            <div className="mt-4">
              <Notice tone="error">
                {failed.map(([t, e]) => (
                  <span key={t} className="block"><strong>{t}:</strong> {e}</span>
                ))}
                Remove unavailable investments to see results.
              </Notice>
            </div>
          )}
          {!weightsOk && <div className="mt-4"><Notice tone="warning">Weights must add up to 100% to run the test.</Notice></div>}
          {loading && <div className="flex h-72 items-center justify-center"><Spinner label="Loading real price history" /></div>}
          {analysis && "error" in analysis && <div className="mt-4"><Notice tone="warning">{analysis.error}</Notice></div>}

          {analysis && !("error" in analysis) && (
            <>
              {analysis.shortened && (
                <div className="mt-4">
                  <Notice tone="info">History starts {fmtDate(analysis.start)}: the youngest investment in this mix doesn&rsquo;t go back further.</Notice>
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat label="Your portfolio" value={compactUsd(analysis.port[analysis.port.length - 1])} sub={`${pct(analysis.ps.cagr, 1)} / yr`} />
                <Stat label="Holding SPY" value={compactUsd(analysis.bench[analysis.bench.length - 1])} sub={`${pct(analysis.bs.cagr, 1)} / yr`} />
                <Stat label="Volatility" value={pct(analysis.ps.volatility)} sub={`SPY ${pct(analysis.bs.volatility)}`} />
                <Stat label="Max drawdown" value={pct(analysis.ps.maxDrawdown)} tone="negative" sub={`SPY ${pct(analysis.bs.maxDrawdown)}`} />
              </div>
              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} ticks={analysis.axis.ticks} interval={0} tickFormatter={analysis.axis.format} />
                    <YAxis {...axisProps} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => compactUsd(v)} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <TooltipCard
                            title={fmtDate(String(payload[0].payload.date))}
                            rows={[
                              { label: "Your portfolio", value: usd(Number(payload[0].payload.port)), color: C.navy },
                              { label: "Holding SPY", value: usd(Number(payload[0].payload.bench)), color: C.copper },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Line dataKey="port" stroke={C.navy} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line dataKey="bench" stroke={C.copper} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3"><Legend items={[{ label: "Your portfolio", color: C.navy }, { label: "Holding SPY (S&P 500)", color: C.copper, dashed: true }]} /></div>
              <p className="mt-2 text-xs text-muted">{fmtDate(analysis.dates[0])} – {fmtDate(analysis.dates[analysis.dates.length - 1])} · {usd(initial)} invested at the start · ignores taxes and fees</p>
            </>
          )}
        </Card>
      </div>

      {analysis && !("error" in analysis) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <Card>
            <h3 className="font-serif text-lg text-navy">Allocation</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={holdings.filter((h) => h.weight > 0)} dataKey="weight" nameKey="ticker" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
                    {holdings.filter((h) => h.weight > 0).map((h) => (
                      <Cell key={h.ticker} fill={C.series[holdings.indexOf(h) % C.series.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={String(payload[0].name)} rows={[{ label: "Weight", value: `${payload[0].value}%` }]} /> : null)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-charcoal">
              Largest holding: <strong>{pct(analysis.conc.largest, 0)}</strong>. Behaves like about <strong>{num(analysis.conc.effectiveHoldings, 1)}</strong> equal-sized holdings.
            </p>
            <p className="mt-1 text-xs text-muted">Concentration: the more weight in a few holdings, the more one bad outcome can hurt the whole portfolio.</p>
          </Card>
          <Card className="min-w-0">
            <h3 className="font-serif text-lg text-navy">Each investment over the same period</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full min-w-[560px] text-right text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 text-left">Investment</th><th className="py-2">Return / yr</th><th className="py-2">Volatility</th><th className="py-2">Max drawdown</th>{analysis.each.map((e) => <th key={e.ticker} className="py-2 pl-2">{e.ticker}</th>)}</tr>
                </thead>
                <tbody>
                  {analysis.each.map((e, i) => (
                    <tr key={e.ticker} className="border-t border-slate">
                      <td className="py-2 text-left"><span className="font-semibold text-navy">{e.ticker}</span></td>
                      <td className={`py-2 ${e.cagr < 0 ? "text-negative" : ""}`}>{pct(e.cagr)}</td>
                      <td className="py-2">{pct(e.volatility)}</td>
                      <td className="py-2 text-negative">{pct(e.maxDrawdown)}</td>
                      {analysis.corr[i].map((c, j) => (
                        <td key={j} className="py-2 pl-2" style={{ background: i === j ? "transparent" : `rgba(36,99,154,${Math.max(0, c) * 0.25})` }}>{i === j ? "—" : num(c, 2)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-muted">
              <li><strong className="text-charcoal">Volatility:</strong> how much returns swing from day to day, scaled to a year. Higher means a bumpier ride.</li>
              <li><strong className="text-charcoal">Max drawdown:</strong> the biggest fall from a high point to a later low before recovering.</li>
              <li><strong className="text-charcoal">Correlation</strong> (right columns): +1 means two investments move together; near 0 means they move independently, which helps diversify.</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

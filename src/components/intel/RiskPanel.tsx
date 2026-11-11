"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TickerSearch } from "@/components/TickerSearch";
import { Notice, NumberField, Segmented, Spinner } from "@/components/form";
import { Card } from "@/components/ui";
import { C, TooltipCard, axisProps, dateTicks, downsample } from "@/components/charts/theme";
import { useHistories } from "@/lib/client/data";
import { fmtDate, num, pct } from "@/lib/format";
import { alignTotalReturn, concentration, correlation, rangeStart, simpleReturns, summarize, type RangeKey } from "@/lib/metrics";

const PERIODS: RangeKey[] = ["1Y", "3Y", "5Y", "10Y"];

export function RiskPanel() {
  const [tickers, setTickers] = useState<string[]>(["SPY", "QQQ", "BND", "NVDA"]);
  const [weights, setWeights] = useState<Record<string, number>>({ SPY: 40, QQQ: 20, BND: 30, NVDA: 10 });
  const [period, setPeriod] = useState<RangeKey>("5Y");
  const { loading, data, errors } = useHistories(tickers);

  const a = useMemo(() => {
    const hs = tickers.map((t) => data[t]).filter(Boolean);
    if (loading || hs.length < 1) return null;
    const latest = hs.map((h) => h.lastDate).sort()[0];
    const start = [rangeStart(latest, period), ...hs.map((h) => h.firstDate)].sort().at(-1)!;
    const { dates, series } = alignTotalReturn(hs, start);
    if (dates.length < 30) return null;
    const stats = hs.map((h, k) => {
      const s = summarize(series[k], dates);
      return { ticker: h.ticker, ...s };
    });
    const rets = series.map((s) => simpleReturns(s));
    const corr = rets.map((x) => rets.map((y) => correlation(x, y)));
    // Underwater chart: % below the running peak
    const peaks = hs.map(() => 0);
    const under = dates.map((d, i) => {
      const p: Record<string, number | string> = { date: d };
      hs.forEach((h, k) => {
        peaks[k] = Math.max(peaks[k], series[k][i]);
        p[h.ticker] = series[k][i] / peaks[k] - 1;
      });
      return p;
    });
    return { hs, dates, stats, corr, under: downsample(under, 500), start };
  }, [loading, data, tickers, period]);

  const axis = useMemo(() => dateTicks((a?.under ?? []).map((p) => String(p.date))), [a]);
  const conc = concentration(tickers.map((t) => weights[t] ?? 0));
  const failed = Object.entries(errors);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-navy">Risk lab</h2>
            <p className="mt-1 text-sm text-muted">Risk measured from real price history (dividends reinvested). Add up to 6 investments.</p>
          </div>
          <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TickerSearch compact onSelect={(r) => { if (!tickers.includes(r.ticker) && tickers.length < 6) { setTickers([...tickers, r.ticker]); setWeights({ ...weights, [r.ticker]: 10 }); } }} placeholder="Add an investment" />
          <div className="flex flex-wrap gap-2">
            {tickers.map((t, i) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-slate-line bg-white py-1 pl-3 pr-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.series[i % C.series.length] }} />
                <span className="font-semibold text-navy">{t}</span>
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTickers(tickers.filter((x) => x !== t))} className="rounded-full px-1.5 text-muted hover:bg-slate hover:text-negative">×</button>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {failed.length > 0 && <Notice tone="error">{failed.map(([t, e]) => <span key={t} className="block"><strong>{t}:</strong> {e}</span>)}</Notice>}
      {loading && <Card className="flex h-60 items-center justify-center"><Spinner label="Loading price history" /></Card>}

      {a && (
        <>
          <Card>
            <h3 className="font-serif text-lg text-navy">Return and risk, {fmtDate(a.dates[0])} – {fmtDate(a.dates.at(-1)!)}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full min-w-[620px] text-right text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 text-left">Investment</th><th className="py-2">Return / yr</th><th className="py-2">Volatility</th><th className="py-2">Max drawdown</th><th className="py-2">Worst fall dates</th></tr>
                </thead>
                <tbody>
                  {a.stats.map((s, i) => (
                    <tr key={s.ticker} className="border-t border-slate">
                      <td className="py-2 text-left"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.series[i % C.series.length] }} /><span className="font-semibold text-navy">{s.ticker}</span></td>
                      <td className={`py-2 ${s.cagr < 0 ? "text-negative" : ""}`}>{pct(s.cagr)}</td>
                      <td className="py-2">{pct(s.volatility)}</td>
                      <td className="py-2 text-negative">{pct(s.maxDrawdown)}</td>
                      <td className="py-2 text-xs text-muted">{fmtDate(s.maxDrawdownPeak)} → {fmtDate(s.maxDrawdownTrough)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2">
              <div><dt className="inline font-semibold text-charcoal">Volatility: </dt><dd className="inline">how much returns swing day to day, scaled to a year; higher means a bumpier ride.</dd></div>
              <div><dt className="inline font-semibold text-charcoal">Maximum drawdown: </dt><dd className="inline">the biggest drop from a high point to a later low, which shows how much you could have lost at the worst moment.</dd></div>
            </dl>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="min-w-0">
              <h3 className="font-serif text-lg text-navy">How far below its peak</h3>
              <p className="text-xs text-muted">Each line shows the % below that investment&rsquo;s previous high on each day.</p>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.under} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} ticks={axis.ticks} interval={0} tickFormatter={axis.format} />
                    <YAxis {...axisProps} width={48} tickFormatter={(v: number) => pct(v, 0)} />
                    <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={fmtDate(String(payload[0].payload.date))} rows={payload.map((p) => ({ label: String(p.dataKey), value: pct(Number(p.value)), color: String(p.color) }))} /> : null)} />
                    {a.hs.map((h, i) => <Line key={h.ticker} dataKey={h.ticker} stroke={C.series[i % C.series.length]} strokeWidth={1.75} dot={false} isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="min-w-0">
              <h3 className="font-serif text-lg text-navy">Correlation</h3>
              <p className="text-xs text-muted"><strong className="text-charcoal">Correlation</strong> measures whether two investments tend to move together (+1), independently (0), or opposite (−1); low correlation helps diversify.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="num text-center text-sm">
                  <thead><tr><th />{a.hs.map((h) => <th key={h.ticker} className="px-2 py-1 text-xs text-muted">{h.ticker}</th>)}</tr></thead>
                  <tbody>
                    {a.hs.map((h, i) => (
                      <tr key={h.ticker}>
                        <th className="px-2 py-1 text-left text-xs text-muted">{h.ticker}</th>
                        {a.corr[i].map((c, j) => (
                          <td key={j} className="px-2 py-1.5 text-xs" style={{ background: i === j ? "#E8EEF3" : c >= 0 ? `rgba(36,99,154,${Math.min(0.6, c * 0.6)})` : `rgba(199,123,57,${Math.min(0.6, -c * 0.6)})`, color: c > 0.65 && i !== j ? "#fff" : undefined }}>
                            {num(c, 2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="font-serif text-lg text-navy">Concentration</h3>
            <p className="text-xs text-muted"><strong className="text-charcoal">Concentration</strong> measures how much of a portfolio depends on a few holdings; the more concentrated, the more one bad outcome hurts.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tickers.map((t) => (
                  <NumberField key={t} label={`${t} weight`} value={weights[t] ?? 0} onChange={(v) => setWeights({ ...weights, [t]: v })} min={0} max={100} step={5} suffix="%" />
                ))}
              </div>
              <div className="rounded-xl bg-slate/60 p-4 text-sm">
                <p>Largest holding: <strong className="num">{pct(conc.largest, 0)}</strong></p>
                <p className="mt-1">Behaves like <strong className="num">{num(conc.effectiveHoldings, 1)}</strong> equal-sized holdings</p>
                <p className="mt-2 text-xs text-muted">Weights are scaled to 100% if they don&rsquo;t add up. The &ldquo;effective number&rdquo; is 1 ÷ the sum of squared weights.</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}


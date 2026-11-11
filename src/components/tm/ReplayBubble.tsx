"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Notice, Segmented, Spinner, Stat } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps, dateTicks, downsample } from "@/components/charts/theme";
import { useHistories } from "@/lib/client/data";
import { compactUsd, fmtDate, pct, usd } from "@/lib/format";
import { indexOnOrAfter, indexOnOrBefore, splitAdjustedCloses } from "@/lib/metrics";
import { simulate, type Action, type Timeline } from "@/lib/timemachine";
import type { PriceHistory } from "@/lib/types";

const DECISION = "2000-03-10"; // the day the Nasdaq Composite closed at its dot-com peak
const AMOUNT = 10000;
const BASKET = ["CSCO", "INTC", "AMZN"];
const TICKERS = ["QQQ", "SPY", ...BASKET];

const CHOICES = [
  { id: "qqq", label: "Buy the Nasdaq-100", sub: "QQQ: the biggest tech companies", color: C.navy },
  { id: "basket", label: "Buy internet leaders", sub: "Cisco, Intel, Amazon, equal amounts", color: C.copper },
  { id: "spy", label: "Buy the whole market", sub: "SPY: all S&P 500 companies", color: C.blue },
  { id: "wait", label: "Wait", sub: "Keep cash for now", color: "#9AA7B5" },
] as const;
type ChoiceId = (typeof CHOICES)[number]["id"];

const HORIZONS = [
  { value: "2002-10-09", label: "Oct 2002 low" },
  { value: "2007-12-31", label: "2007" },
  { value: "2015-12-31", label: "2015" },
  { value: "latest", label: "Today" },
] as const;

function timeline(id: ChoiceId, start: string, end: string): Timeline {
  const actions: Action[] = [];
  if (id === "qqq") actions.push({ id: "q", type: "buy", date: start, ticker: "QQQ", amount: { kind: "all" } });
  if (id === "spy") actions.push({ id: "s", type: "buy", date: start, ticker: "SPY", amount: { kind: "all" } });
  if (id === "basket") BASKET.forEach((t, i) => actions.push({ id: `b${i}`, type: "buy", date: start, ticker: t, amount: { kind: "dollars", value: AMOUNT / BASKET.length } }));
  return { id, name: id, startDate: start, endDate: end, startingCash: AMOUNT, dividendMode: "reinvest", actions };
}

/**
 * Recovery date: the first day AFTER the lowest point that the value is back to the amount invested.
 * Returns "never-below" if it never fell below cost, or null if it hasn't recovered in the data.
 */
function breakEven(days: { date: string; total: number }[]) {
  if (days.length === 0) return null;
  let low = 0;
  for (let i = 1; i < days.length; i++) if (days[i].total < days[low].total) low = i;
  if (days[low].total >= AMOUNT - 0.01) return "never-below";
  for (let i = low + 1; i < days.length; i++) if (days[i].total >= AMOUNT - 0.01) return days[i].date;
  return null;
}

export function ReplayBubble() {
  const { loading, data, errors } = useHistories(TICKERS);
  const [choice, setChoice] = useState<ChoiceId | null>(null);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]["value"]>("2002-10-09");
  const failed = Object.entries(errors);
  const ready = !loading && TICKERS.every((t) => data[t]);

  const before = useMemo(() => {
    if (!ready) return null;
    const q = data.QQQ;
    const adj = splitAdjustedCloses(q.rows);
    const e = indexOnOrBefore(q.rows, DECISION);
    const points = q.rows.slice(0, e + 1).map((r, i) => ({ date: r[0], close: adj[i] }));
    const yearAgo = indexOnOrAfter(q.rows, "1999-03-10");
    const oneYear = adj[e] / adj[yearAgo] - 1;
    const tickerYear = (h: PriceHistory) => {
      const a = splitAdjustedCloses(h.rows);
      return a[indexOnOrBefore(h.rows, DECISION)] / a[indexOnOrAfter(h.rows, "1999-03-10")] - 1;
    };
    return { points, oneYear, basketYears: BASKET.map((t) => ({ t, r: tickerYear(data[t]) })), spyYear: tickerYear(data.SPY) };
  }, [ready, data]);

  const outcomes = useMemo(() => {
    if (!ready || !choice) return null;
    const cal = data.SPY.rows;
    const end = horizon === "latest" ? data.SPY.lastDate : horizon;
    const sims = Object.fromEntries(CHOICES.map((c) => [c.id, simulate(timeline(c.id, DECISION, end), data, cal)])) as Record<ChoiceId, ReturnType<typeof simulate>>;
    // Same thesis, different price: QQQ bought at three different times, held to today
    const latest = data.SPY.lastDate;
    const entries = [
      { label: "Early: Mar 10, 1999 (QQQ's first day)", date: data.QQQ.firstDate },
      { label: "At the peak: Mar 10, 2000", date: DECISION },
      { label: "After the crash: Oct 9, 2002", date: "2002-10-09" },
    ].map((e) => {
      const s = simulate(timeline("qqq", e.date, latest), data, cal);
      return { ...e, final: s.days.at(-1)!.total, years: (Date.parse(latest) - Date.parse(s.start)) / (365.25 * 864e5), be: breakEven(s.days), executed: s.start };
    });
    const map = new Map<string, Record<string, number | string>>();
    for (const c of CHOICES) for (const d of sims[c.id].days) {
      const p = map.get(d.date) ?? { date: d.date };
      p[c.id] = d.total;
      map.set(d.date, p);
    }
    const full = Object.fromEntries(CHOICES.map((c) => [c.id, simulate(timeline(c.id, DECISION, latest), data, cal)])) as Record<ChoiceId, ReturnType<typeof simulate>>;
    const worst = (id: ChoiceId) => Math.min(...full[id].days.filter((d) => d.date <= "2002-12-31").map((d) => d.total));
    const points = downsample([...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))), 700);
    return {
      sims, entries, end: sims.qqq.end, points,
      axis: dateTicks(points.map((p) => String(p.date))),
      be: Object.fromEntries(CHOICES.map((c) => [c.id, breakEven(full[c.id].days)])) as Record<ChoiceId, string | null>,
      worst: Object.fromEntries(CHOICES.map((c) => [c.id, worst(c.id)])) as Record<ChoiceId, number>,
    };
  }, [ready, choice, horizon, data]);

  if (failed.length) return <Notice tone="error">{failed.map(([t, e]) => <span key={t} className="block"><strong>{t}:</strong> {e}</span>)}</Notice>;
  if (!ready || !before) return <Card className="flex h-72 items-center justify-center"><Spinner label="Loading 1999–2002 market data" /></Card>;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate bg-navy px-6 py-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="copper">Historical replay</Badge>
            <span className="text-xs uppercase tracking-[0.14em] text-white/70">Right idea, wrong price?</span>
          </div>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl">Friday, March 10, 2000</h2>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-charcoal">
              Your conviction: <strong>the internet will transform the economy</strong>. In hindsight, you&rsquo;re right. Online shopping, cloud computing,
              and smartphones are all coming. Today, tech stocks are soaring and the Nasdaq Composite has just closed at a record high.
              You have <strong>{usd(AMOUNT)}</strong> to invest.
            </p>
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={before.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="bb" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={C.positive} stopOpacity={0.22} /><stop offset="100%" stopColor={C.positive} stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(d: string) => `${fmtDate(d).slice(0, 3)} '${d.slice(2, 4)}`} />
                  <YAxis {...axisProps} width={52} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                  <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={fmtDate(String(payload[0].payload.date))} rows={[{ label: "QQQ close (split-adj.)", value: usd(Number(payload[0].value), 2) }]} /> : null)} />
                  <Area dataKey="close" stroke={C.positive} strokeWidth={2} fill="url(#bb)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted">QQQ (Nasdaq-100 fund) from its launch through March 10, 2000. Nothing after this date is shown until you decide.</p>
          </div>
          <div className="space-y-3">
            <Stat label="QQQ, past 12 months" value={pct(before.oneYear, 0, true)} tone="positive" sub="Price change since Mar 10, 1999" />
            <Stat label="S&P 500 (SPY), 12 months" value={pct(before.spyYear, 0, true)} sub="The broad market" />
            <div className="rounded-xl border border-slate-line/70 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Leaders, 12 months</p>
              {before.basketYears.map((b) => (
                <p key={b.t} className="num mt-1 flex justify-between text-sm"><span className="font-semibold text-navy">{b.t}</span><span className="text-positive">{pct(b.r, 0, true)}</span></p>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-xl text-navy">What do you do with {usd(AMOUNT)}?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHOICES.map((c) => (
            <button key={c.id} type="button" onClick={() => setChoice(c.id)} className={`rounded-2xl border p-4 text-left transition ${choice === c.id ? "border-navy bg-navy text-white shadow-lift" : "border-slate-line bg-white hover:border-navy/40"}`}>
              <p className="font-serif text-lg">{c.label}</p>
              <p className={`text-xs ${choice === c.id ? "text-white/75" : "text-muted"}`}>{c.sub}</p>
            </button>
          ))}
        </div>
        {!choice && <p className="mt-4 text-sm text-muted">Choose one to reveal what happened next.</p>}
      </Card>

      {choice && outcomes && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge tone="copper">Revealed</Badge>
                <h3 className="mt-2 font-serif text-xl text-navy">The thesis was right. The price wasn&rsquo;t.</h3>
              </div>
              <Segmented label="Look ahead to" options={HORIZONS} value={horizon} onChange={setHorizon} size="sm" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {CHOICES.map((c) => {
                const v = outcomes.sims[c.id].days.at(-1)!.total;
                const be = outcomes.be[c.id];
                return (
                  <div key={c.id} className={`rounded-xl border px-4 py-3 ${c.id === choice ? "border-navy ring-2 ring-navy/15" : "border-slate-line/70"}`}>
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.label}{c.id === choice && <span className="text-copper">· you</span>}
                    </p>
                    <p className="num mt-1 font-serif text-2xl text-navy">{compactUsd(v)}</p>
                    <p className={`num text-xs ${v >= AMOUNT ? "text-positive" : "text-negative"}`}>{pct(v / AMOUNT - 1, 0, true)}</p>
                    {c.id !== "wait" && (
                      <p className="mt-1 text-[11px] leading-snug text-muted">
                        Low point by 2002: {compactUsd(outcomes.worst[c.id])}. {be === "never-below" ? "Never fell below the amount invested." : be ? `Recovered to ${usd(AMOUNT)} on ${fmtDate(be)}.` : "Has not recovered to the amount invested in this data."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={outcomes.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} ticks={outcomes.axis.ticks} interval={0} tickFormatter={outcomes.axis.format} />
                  <YAxis {...axisProps} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => compactUsd(v)} />
                  <ReferenceLine y={AMOUNT} stroke={C.muted} strokeDasharray="3 3" label={{ value: "Money invested", fill: C.muted, fontSize: 11, position: "insideBottomRight" }} />
                  <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={fmtDate(String(payload[0].payload.date))} rows={CHOICES.map((c) => ({ label: c.label, value: usd(Number(payload[0].payload[c.id])), color: c.color }))} /> : null)} />
                  {CHOICES.map((c) => (
                    <Line key={c.id} dataKey={c.id} stroke={c.color} strokeWidth={c.id === choice ? 3.5 : 1.75} strokeOpacity={c.id === choice ? 1 : 0.55} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted">
              Real end-of-day prices, dividends reinvested, splits handled, through {fmtDate(outcomes.end)}. &ldquo;Wait&rdquo; stays in cash (no interest assumed).
              The basket shows three well-known leaders, chosen with hindsight; many internet companies of that era went out of business entirely, which this replay can&rsquo;t show because their price data isn&rsquo;t in our free data.
            </p>
          </Card>

          <Card>
            <h3 className="font-serif text-xl text-navy">Same idea, three different entry prices</h3>
            <p className="mt-1 text-sm text-muted">{usd(AMOUNT)} in QQQ, held until today. Only the purchase date changes.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {outcomes.entries.map((e) => (
                <div key={e.label} className="rounded-xl border border-slate-line/70 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{e.label}</p>
                  <p className="num mt-1 font-serif text-2xl text-navy">{compactUsd(e.final)}</p>
                  <p className="num text-xs text-muted">{pct(Math.pow(e.final / AMOUNT, 1 / e.years) - 1, 1)} a year over {e.years.toFixed(0)} years</p>
                  <p className="mt-1 text-xs text-charcoal">
                    {e.be === "never-below" ? "Never fell below the amount invested." : e.be ? <>Recovered to {usd(AMOUNT)} after its low on <strong>{fmtDate(e.be)}</strong>.</> : "Still below the amount invested."}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-slate/60 px-4 py-3 text-sm leading-relaxed text-charcoal">
              <strong>The lesson:</strong> predicting a trend correctly doesn&rsquo;t guarantee good returns. What you pay matters. When prices already
              assume a bright future, even a correct prediction can take many years to pay off.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

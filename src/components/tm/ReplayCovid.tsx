"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Notice, Segmented, Spinner, Stat } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps, dateTicks, downsample } from "@/components/charts/theme";
import { useHistories } from "@/lib/client/data";
import { compactUsd, fmtDate, pct, price, usd } from "@/lib/format";
import { indexOnOrBefore } from "@/lib/metrics";
import { simulate, type Action, type Timeline } from "@/lib/timemachine";

const DECISION = "2020-03-16";
const BUY_DATE = "2020-01-02";
const INVESTED = 10000;
const SIDE_CASH = 5000;

const CHOICES = [
  { id: "sell", label: "Sell everything", sub: "Move to cash and wait it out", color: C.negative },
  { id: "half", label: "Sell half", sub: "Reduce risk, keep some exposure", color: "#8A5A2B" },
  { id: "hold", label: "Hold", sub: "Do nothing", color: C.navy },
  { id: "buy", label: "Buy more", sub: `Invest my ${usd(SIDE_CASH)} cash too`, color: C.positive },
] as const;
type ChoiceId = (typeof CHOICES)[number]["id"];

const HORIZONS = [
  { value: "2020-12-31", label: "End of 2020" },
  { value: "2021-12-31", label: "End of 2021" },
  { value: "latest", label: "Today" },
] as const;

export function ReplayCovid() {
  const { loading, data, errors } = useHistories(["SPY"]);
  const [choice, setChoice] = useState<ChoiceId | null>(null);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]["value"]>("2020-12-31");
  const spy = data.SPY;

  const before = useMemo(() => {
    if (!spy) return null;
    const end = indexOnOrBefore(spy.rows, DECISION);
    const start = indexOnOrBefore(spy.rows, "2019-01-02");
    const rows = spy.rows.slice(Math.max(0, start), end + 1);
    let peak = rows[0];
    for (const r of rows) if (r[1] > peak[1]) peak = r;
    const today = rows[rows.length - 1];
    const buyRow = spy.rows[indexOnOrBefore(spy.rows, BUY_DATE)];
    return {
      points: rows.map((r) => ({ date: r[0], close: r[1] })),
      peak, today,
      drawdown: today[1] / peak[1] - 1,
      sinceBuy: today[1] / buyRow[1] - 1,
    };
  }, [spy]);

  const outcomes = useMemo(() => {
    if (!spy || !choice) return null;
    const end = horizon === "latest" ? spy.lastDate : horizon;
    const mk = (id: ChoiceId): Timeline => {
      const actions: Action[] = [{ id: "b", type: "buy", date: BUY_DATE, ticker: "SPY", amount: { kind: "dollars", value: INVESTED } }];
      if (id === "sell") actions.push({ id: "d", type: "sell", date: DECISION, ticker: "SPY", amount: { kind: "all" } });
      if (id === "half") actions.push({ id: "d", type: "sell", date: DECISION, ticker: "SPY", amount: { kind: "percent", value: 50 } });
      if (id === "buy") actions.push({ id: "d", type: "buy", date: DECISION, ticker: "SPY", amount: { kind: "all" } });
      return { id, name: id, startDate: BUY_DATE, endDate: end, startingCash: INVESTED + SIDE_CASH, dividendMode: "reinvest", actions };
    };
    const sims = Object.fromEntries(CHOICES.map((c) => [c.id, simulate(mk(c.id), data, spy.rows)])) as Record<ChoiceId, ReturnType<typeof simulate>>;
    const map = new Map<string, Record<string, number | string>>();
    for (const c of CHOICES) for (const d of sims[c.id].days) {
      if (d.date < "2020-02-01") continue;
      const p = map.get(d.date) ?? { date: d.date };
      p[c.id] = d.total;
      map.set(d.date, p);
    }
    // What actually happened next (computed from real closes)
    const iDec = indexOnOrBefore(spy.rows, DECISION);
    let low = spy.rows[iDec];
    for (let i = iDec; i < spy.rows.length && spy.rows[i][0] <= "2020-12-31"; i++) if (spy.rows[i][1] < low[1]) low = spy.rows[i];
    const peakClose = before!.peak[1];
    const recovered = spy.rows.find((r) => r[0] > DECISION && r[1] >= peakClose);
    const points = downsample([...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))), 600);
    return { sims, points, axis: dateTicks(points.map((p) => String(p.date))), low, recovered, end: sims.hold.end };
  }, [spy, choice, horizon, data, before]);

  if (loading) return <Card className="flex h-72 items-center justify-center"><Spinner label="Loading 2020 market data" /></Card>;
  if (errors.SPY || !spy || !before) return <Notice tone="error">{errors.SPY ?? "Market data unavailable."}</Notice>;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate bg-navy px-6 py-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="copper">Historical replay</Badge>
            <span className="text-xs uppercase tracking-[0.14em] text-white/70">Information as of the close</span>
          </div>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl">Monday, March 16, 2020</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-charcoal">
              On January 2, 2020 you invested <strong>{usd(INVESTED)}</strong> in SPY (an S&amp;P 500 fund) and kept <strong>{usd(SIDE_CASH)}</strong> in cash.
              Since then, COVID-19 has spread worldwide. The WHO declared a pandemic on March 11, the U.S. declared a national emergency on March 13,
              and on Sunday, March 15, the Federal Reserve cut interest rates to near zero. Markets fell sharply anyway.
            </p>
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={before.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cv" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={C.navy} stopOpacity={0.2} /><stop offset="100%" stopColor={C.navy} stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(d: string) => `${fmtDate(d).slice(0, 3)} '${d.slice(2, 4)}`} />
                  <YAxis {...axisProps} width={52} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                  <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={fmtDate(String(payload[0].payload.date))} rows={[{ label: "SPY close", value: price(Number(payload[0].value)) }]} /> : null)} />
                  <ReferenceLine x={before.peak[0]} stroke={C.copper} strokeDasharray="4 4" label={{ value: "Peak", fill: C.copper, fontSize: 11, position: "insideTopLeft" }} />
                  <Area dataKey="close" stroke={C.navy} strokeWidth={2} fill="url(#cv)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted">SPY daily closes through March 16, 2020. Nothing after this date is shown until you decide.</p>
          </div>
          <div className="space-y-3">
            <Stat label="SPY close today" value={price(before.today[1])} sub={fmtDate(before.today[0])} />
            <Stat label="Fall from peak" value={pct(before.drawdown)} tone="negative" sub={`Peak ${price(before.peak[1])} on ${fmtDate(before.peak[0])}`} />
            <Stat label="Your investment" value={usd(INVESTED * (1 + before.sinceBuy))} tone="negative" sub={`${pct(before.sinceBuy, 1, true)} since Jan 2 (price only)`} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-xl text-navy">What do you do at today&rsquo;s close?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChoice(c.id)}
              className={`rounded-2xl border p-4 text-left transition ${choice === c.id ? "border-navy bg-navy text-white shadow-lift" : "border-slate-line bg-white hover:border-navy/40"}`}
            >
              <p className="font-serif text-lg">{c.label}</p>
              <p className={`text-xs ${choice === c.id ? "text-white/75" : "text-muted"}`}>{c.sub}</p>
            </button>
          ))}
        </div>
        {!choice && <p className="mt-4 text-sm text-muted">Choose one to reveal what happened next.</p>}
      </Card>

      {choice && outcomes && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="copper">Revealed</Badge>
              <h3 className="mt-2 font-serif text-xl text-navy">What actually happened</h3>
            </div>
            <Segmented label="Look ahead to" options={HORIZONS} value={horizon} onChange={setHorizon} size="sm" />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-charcoal">
            {outcomes.low[0] === before.today[0]
              ? <>March 16 turned out to be SPY&rsquo;s lowest close of 2020.</>
              : <>SPY&rsquo;s lowest close of 2020 came {Math.round((Date.parse(outcomes.low[0]) - Date.parse(DECISION)) / 864e5)} days later: <strong>{price(outcomes.low[1])}</strong> on <strong>{fmtDate(outcomes.low[0])}</strong>.</>}
            {outcomes.recovered ? <> It got back above its February peak on <strong>{fmtDate(outcomes.recovered[0])}</strong>, {Math.round((Date.parse(outcomes.recovered[0]) - Date.parse(DECISION)) / 864e5)} days after your decision.</> : " It has not yet regained its February peak in this data."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CHOICES.map((c) => {
              const v = outcomes.sims[c.id].days.at(-1)!.total;
              return (
                <div key={c.id} className={`rounded-xl border px-4 py-3 ${c.id === choice ? "border-navy ring-2 ring-navy/15" : "border-slate-line/70"}`}>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.label}{c.id === choice && <span className="text-copper">· you</span>}
                  </p>
                  <p className="num mt-1 font-serif text-2xl text-navy">{compactUsd(v)}</p>
                  <p className={`num text-xs ${v >= INVESTED + SIDE_CASH ? "text-positive" : "text-negative"}`}>{pct(v / (INVESTED + SIDE_CASH) - 1, 1, true)} on {usd(INVESTED + SIDE_CASH)}</p>
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
                <ReferenceLine x={DECISION} stroke={C.copper} strokeDasharray="4 4" label={{ value: "Your decision", fill: C.copper, fontSize: 11, position: "insideTopRight" }} />
                <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={fmtDate(String(payload[0].payload.date))} rows={CHOICES.map((c) => ({ label: c.label, value: usd(Number(payload[0].payload[c.id])), color: c.color }))} /> : null)} />
                {CHOICES.map((c) => (
                  <Line key={c.id} dataKey={c.id} stroke={c.color} strokeWidth={c.id === choice ? 3.5 : 1.75} strokeOpacity={c.id === choice ? 1 : 0.55} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted">
            Total value including the {usd(SIDE_CASH)} side cash. Real SPY closes, dividends reinvested, through {fmtDate(outcomes.end)}. &ldquo;Sell&rdquo; paths stay in cash and never buy back, so this shows the cost of not getting back in.
            Each path runs through the same accounting engine as the Time Machine.
          </p>
        </Card>
      )}
    </div>
  );
}

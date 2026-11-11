"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumberField, Stat } from "@/components/form";
import { Card } from "@/components/ui";
import { C, Legend, TooltipCard, axisProps } from "@/components/charts/theme";
import { DEFAULT_INPUTS, costOfWaiting } from "@/lib/growth";
import { compactUsd, usd } from "@/lib/format";

export function WaitingPanel() {
  const [initial, setInitial] = useState(5000);
  const [monthly, setMonthly] = useState(400);
  const [years, setYears] = useState(35);
  const [ret, setRet] = useState(6);
  const [delay, setDelay] = useState(10);

  const d = Math.min(delay, years - 1);
  const res = useMemo(
    () => costOfWaiting({ ...DEFAULT_INPUTS, initial, monthly, years, annualReturn: ret, contributionIncrease: 0 }, d),
    [initial, monthly, years, ret, d],
  );

  const data = useMemo(() => {
    const pts = [{ year: 0, now: initial, later: 0 }];
    for (let y = 1; y <= years; y++) {
      const later = y <= res.delay ? 0 : res.later.rows[y - res.delay - 1]?.endValue ?? 0;
      pts.push({ year: y, now: res.now.rows[y - 1].endValue, later });
    }
    return pts;
  }, [res, years, initial]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Card>
        <h2 className="font-serif text-xl text-navy">The cost of waiting</h2>
        <p className="mt-1 text-sm text-muted">
          Same habits, same end date. The only difference is when you start.
        </p>
        <div className="mt-5 grid gap-4">
          <NumberField label="Starting amount" prefix="$" value={initial} onChange={setInitial} min={0} step={500} />
          <NumberField label="Monthly contribution" prefix="$" value={monthly} onChange={setMonthly} min={0} step={50} />
          <NumberField label="Time until your goal" value={years} onChange={(v) => setYears(Math.max(2, Math.round(v)))} min={2} max={60} suffix="years" />
          <NumberField label="Assumed annual return" value={ret} onChange={setRet} min={-10} max={20} step={0.25} suffix="%" hint="An assumption, not a prediction." />
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm font-medium text-charcoal">
              Wait before starting <span className="num text-navy">{d} {d === 1 ? "year" : "years"}</span>
            </span>
            <input
              type="range"
              min={1}
              max={years - 1}
              value={d}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full accent-[#C77B39]"
              aria-label="Years to wait"
            />
          </label>
        </div>
      </Card>

      <Card className="min-w-0">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Start now" value={compactUsd(res.now.finalValue)} sub={`${usd(res.now.totalContributed)} put in`} />
          <Stat label={`Start in ${res.delay} yrs`} value={compactUsd(res.later.finalValue)} sub={`${usd(res.later.totalContributed)} put in`} />
          <Stat label="Cost of waiting" value={compactUsd(res.cost)} tone="negative" sub="Less at the same end date" />
          <Stat label="To catch up" value={`${usd(res.monthlyNeededToCatchUp)}/mo`} tone="accent" sub={`vs ${usd(monthly)}/mo starting now`} />
        </div>

        <div className="mt-6 h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="year" {...axisProps} tickFormatter={(y: number) => `Yr ${y}`} minTickGap={24} />
              <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactUsd(v)} />
              <ReferenceLine x={res.delay} stroke={C.copper} strokeDasharray="4 4" label={{ value: "Late start", fill: C.copper, fontSize: 11, position: "insideTopRight" }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof data)[number];
                  return (
                    <TooltipCard
                      title={`End of year ${p.year}`}
                      rows={[
                        { label: "Start now", value: usd(p.now), color: C.navy },
                        { label: `Start in ${res.delay} yrs`, value: usd(p.later), color: C.copper },
                      ]}
                    />
                  );
                }}
              />
              <Line type="monotone" dataKey="now" stroke={C.navy} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="later" stroke={C.copper} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3">
          <Legend items={[{ label: "Start now", color: C.navy }, { label: `Wait ${res.delay} years, then start`, color: C.copper }]} />
        </div>
        <p className="mt-4 rounded-xl bg-slate/60 px-4 py-3 text-sm leading-relaxed text-charcoal">
          Waiting {res.delay} years means putting in <strong>{usd(res.now.totalContributed - res.later.totalContributed)}</strong> less,
          but ending with <strong>{usd(res.cost)}</strong> less: the difference is the growth those early dollars would have had time to earn.
          The late starter keeps the starting amount uninvested until they begin.
        </p>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, NumberField, Toggle } from "@/components/form";
import { Card } from "@/components/ui";
import { C, Legend, TooltipCard, axisProps } from "@/components/charts/theme";
import { DEFAULT_INPUTS, project } from "@/lib/growth";
import { compactUsd, usd } from "@/lib/format";

interface Strategy {
  name: string;
  initial: number;
  monthly: number;
  annualReturn: number;
  contributionIncrease: number;
}

const DEFAULTS: Strategy[] = [
  { name: "Steady saver", initial: 10000, monthly: 500, annualReturn: 4, contributionIncrease: 0 },
  { name: "Balanced", initial: 10000, monthly: 500, annualReturn: 6, contributionIncrease: 0 },
  { name: "Raise 3% a year", initial: 10000, monthly: 500, annualReturn: 6, contributionIncrease: 3 },
];

const COLORS = [C.navy, C.copper, C.blue, "#6F8FAF"];

export function StrategiesPanel() {
  const [years, setYears] = useState(30);
  const [inflation, setInflation] = useState(2.5);
  const [real, setReal] = useState(false);
  const [list, setList] = useState<Strategy[]>(DEFAULTS);

  const results = useMemo(
    () => list.map((s) => project({ ...DEFAULT_INPUTS, ...s, years, inflation, withdrawalStartYear: 0, monthlyWithdrawal: 0 })),
    [list, years, inflation],
  );

  const data = useMemo(() => {
    const pts: Record<string, number>[] = [];
    for (let y = 0; y <= years; y++) {
      const p: Record<string, number> = { year: y };
      results.forEach((r, i) => {
        const v = y === 0 ? list[i].initial : r.rows[y - 1].endValue;
        p[`s${i}`] = real ? v / Math.pow(1 + inflation / 100, y) : v;
      });
      pts.push(p);
    }
    return pts;
  }, [results, years, real, inflation, list]);

  const update = (i: number, patch: Partial<Strategy>) => setList((l) => l.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const best = results.reduce((b, r, i) => (r.finalValue > results[b].finalValue ? i : b), 0);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-navy">Compare strategies side by side</h2>
            <p className="mt-1 text-sm text-muted">Edit each column. All strategies share the same time horizon.</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32"><NumberField label="Years" value={years} onChange={(v) => setYears(Math.round(v))} min={1} max={60} /></div>
            <div className="w-36"><NumberField label="Inflation" value={inflation} onChange={setInflation} min={0} max={15} step={0.25} suffix="%" /></div>
            <div className="pb-2"><Toggle checked={real} onChange={setReal} label="Today's dollars" /></div>
          </div>
        </div>

        <div className={`mt-6 grid gap-4 ${list.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"} ${list.length === 4 ? "xl:grid-cols-4" : ""}`}>
          {list.map((s, i) => {
            const r = results[i];
            const final = real ? r.finalValueReal : r.finalValue;
            return (
              <div key={i} className="rounded-2xl border border-slate-line/80 bg-ivory/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
                  <input
                    value={s.name}
                    onChange={(e) => update(i, { name: e.target.value.slice(0, 40) })}
                    aria-label={`Strategy ${i + 1} name`}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 font-serif text-lg text-navy outline-none focus:bg-white"
                  />
                  {list.length > 2 && (
                    <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setList((l) => l.filter((_, k) => k !== i))} className="rounded-full px-2 text-lg text-muted hover:bg-slate hover:text-negative">
                      ×
                    </button>
                  )}
                </div>
                <div className="mt-3 grid gap-3">
                  <NumberField label="Starting amount" prefix="$" value={s.initial} onChange={(v) => update(i, { initial: v })} min={0} step={500} />
                  <NumberField label="Monthly" prefix="$" value={s.monthly} onChange={(v) => update(i, { monthly: v })} min={0} step={50} />
                  <NumberField label="Assumed return" suffix="%" value={s.annualReturn} onChange={(v) => update(i, { annualReturn: v })} min={-20} max={30} step={0.25} />
                  <NumberField label="Raise contributions" suffix="% / yr" value={s.contributionIncrease} onChange={(v) => update(i, { contributionIncrease: v })} min={0} max={20} step={0.5} />
                </div>
                <div className="mt-4 border-t border-slate pt-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted">After {years} years</p>
                  <p className="num font-serif text-2xl text-navy">
                    {usd(final)} {i === best && list.length > 1 && <span className="ml-1 align-middle text-xs font-sans font-semibold text-copper">Highest</span>}
                  </p>
                  <p className="num text-xs text-muted">
                    {usd(r.totalContributed)} put in · {usd(r.gains)} growth
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {list.length < 4 && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => setList((l) => [...l, { ...l[l.length - 1], name: `Strategy ${l.length + 1}` }])}>
              + Add a strategy
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="h-72 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="year" {...axisProps} tickFormatter={(y: number) => `Yr ${y}`} minTickGap={24} />
              <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactUsd(v)} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipCard
                      title={`End of year ${payload[0].payload.year}${real ? " (today's $)" : ""}`}
                      rows={list.map((s, i) => ({ label: s.name, value: usd(Number(payload[0].payload[`s${i}`])), color: COLORS[i] }))}
                    />
                  ) : null
                }
              />
              {list.map((_, i) => (
                <Line key={i} type="monotone" dataKey={`s${i}`} stroke={COLORS[i]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3">
          <Legend items={list.map((s, i) => ({ label: s.name, color: COLORS[i] }))} />
        </div>
        <p className="mt-3 text-xs text-muted">Returns are assumptions you set, not predictions. Ignores taxes and fees.</p>
      </Card>
    </div>
  );
}

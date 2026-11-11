"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Notice, NumberField, Stat, Toggle } from "@/components/form";
import { Card } from "@/components/ui";
import { C, TooltipCard, axisProps } from "@/components/charts/theme";
import { DEFAULT_INPUTS, project, type GrowthInputs } from "@/lib/growth";
import { compactUsd, pct, usd } from "@/lib/format";
import { deleteSaved, listSaved, newId, upsertSaved, type Saved } from "@/lib/client/storage";

export const SCENARIO_KEY = "wealthlab.scenarios.v1";

export function GrowthInputsForm({ value, onChange }: { value: GrowthInputs; onChange: (v: GrowthInputs) => void }) {
  const set = <K extends keyof GrowthInputs>(k: K, v: GrowthInputs[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField label="Starting amount" prefix="$" value={value.initial} onChange={(v) => set("initial", v)} min={0} step={500} />
      <NumberField label="Monthly contribution" prefix="$" value={value.monthly} onChange={(v) => set("monthly", v)} min={0} step={50} />
      <NumberField label="Years" value={value.years} onChange={(v) => set("years", Math.round(v))} min={1} max={60} suffix="years" />
      <NumberField
        label="Assumed annual return"
        value={value.annualReturn}
        onChange={(v) => set("annualReturn", v)}
        min={-20}
        max={30}
        step={0.25}
        suffix="%"
        hint="An assumption you choose, not a prediction."
      />
      <NumberField
        label="Raise contributions each year by"
        value={value.contributionIncrease}
        onChange={(v) => set("contributionIncrease", v)}
        min={0}
        max={20}
        step={0.5}
        suffix="% / yr"
      />
      <NumberField
        label="Inflation rate (for today's dollars)"
        value={value.inflation}
        onChange={(v) => set("inflation", v)}
        min={0}
        max={15}
        step={0.25}
        suffix="% / yr"
      />
      <div className="rounded-xl bg-slate/60 p-4 sm:col-span-2">
        <p className="text-sm font-medium text-charcoal">Withdrawals (optional)</p>
        <p className="mt-0.5 text-xs text-muted">Contributions stop when withdrawals begin. Set either box to 0 for no withdrawals.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Start withdrawing in year"
            value={value.withdrawalStartYear}
            onChange={(v) => set("withdrawalStartYear", Math.round(v))}
            min={0}
            max={60}
          />
          <NumberField
            label="Monthly withdrawal"
            prefix="$"
            value={value.monthlyWithdrawal}
            onChange={(v) => set("monthlyWithdrawal", v)}
            min={0}
            step={100}
          />
        </div>
      </div>
    </div>
  );
}

export function SimulatorPanel() {
  const [inputs, setInputs] = useState<GrowthInputs>(DEFAULT_INPUTS);
  const [real, setReal] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [saved, setSaved] = useState<Saved<GrowthInputs>[]>([]);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setSaved(listSaved<GrowthInputs>(SCENARIO_KEY)), []);

  const result = useMemo(() => project(inputs), [inputs]);
  const deflate = (v: number, year: number) => (real ? v / Math.pow(1 + inputs.inflation / 100, year) : v);

  const chartData = useMemo(() => {
    const pts = [{ year: 0, value: inputs.initial, net: inputs.initial }];
    for (const r of result.rows) pts.push({ year: r.year, value: r.endValue, net: r.totalContributed - r.totalWithdrawn });
    return pts.map((p) => {
      const value = deflate(p.value, p.year);
      const net = deflate(Math.max(0, p.net), p.year);
      return { year: p.year, value, principal: Math.min(net, value), growth: Math.max(0, value - net), net };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, real, inputs.inflation, inputs.initial]);

  function save(asNew: boolean) {
    const nm = (name || current?.name || "").trim() || `Scenario ${saved.length + 1}`;
    const id = !asNew && current ? current.id : newId();
    const ok = upsertSaved(SCENARIO_KEY, { id, name: nm, savedAt: new Date().toISOString(), data: inputs });
    if (!ok) {
      setMsg("Your browser blocked saving (private browsing?). The scenario was not saved.");
      return;
    }
    setCurrent({ id, name: nm });
    setName(nm);
    setSaved(listSaved(SCENARIO_KEY));
    setMsg(`Saved "${nm}" in this browser.`);
  }

  const finalShown = real ? result.finalValueReal : result.finalValue;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <h2 className="font-serif text-xl text-navy">Your assumptions</h2>
          <p className="mt-1 text-sm text-muted">Change any number. Results update instantly.</p>
          <div className="mt-5">
            <GrowthInputsForm value={inputs} onChange={setInputs} />
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-lg text-navy">Saved scenarios</h3>
          <p className="mt-1 text-xs text-muted">
            Saved <strong>only in this browser</strong> on this device, not in the cloud. Clearing browser data removes them.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this scenario"
              aria-label="Scenario name"
              maxLength={60}
              className="min-w-0 flex-1 rounded-xl border border-slate-line bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <Button size="sm" onClick={() => save(false)}>{current ? "Update" : "Save"}</Button>
            {current && (
              <Button size="sm" variant="secondary" onClick={() => save(true)}>Save as new</Button>
            )}
          </div>
          {current && <p className="mt-2 text-xs text-muted">Editing &ldquo;{current.name}&rdquo;</p>}
          {msg && <p className="mt-2 text-xs text-positive">{msg}</p>}
          {saved.length > 0 && (
            <ul className="mt-4 divide-y divide-slate">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">{s.name}</p>
                    <p className="text-xs text-muted">
                      {usd(s.data.initial)} start · {usd(s.data.monthly)}/mo · {s.data.annualReturn}% · {s.data.years} yrs
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setInputs(s.data);
                        setCurrent({ id: s.id, name: s.name });
                        setName(s.name);
                        setMsg(`Loaded "${s.name}". Edit, then Update to save changes.`);
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        deleteSaved(SCENARIO_KEY, s.id);
                        if (current?.id === s.id) setCurrent(null);
                        setSaved(listSaved(SCENARIO_KEY));
                        setMsg(`Deleted "${s.name}".`);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-navy">Projected outcome</h2>
              <p className="text-xs text-muted">
                At an assumed {inputs.annualReturn}% a year, compounded monthly. Real returns vary and can be negative.
              </p>
            </div>
            <Toggle checked={real} onChange={setReal} label={`Today's dollars (${inputs.inflation}% inflation)`} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label={`Value after ${inputs.years} yrs`} value={compactUsd(finalShown)} sub={real ? "In today's dollars" : usd(result.finalValue)} />
            <Stat label="Total contributed" value={compactUsd(result.totalContributed)} sub="Including starting amount" />
            <Stat label="Investment gains" value={compactUsd(result.gains)} tone={result.gains >= 0 ? "accent" : "negative"} sub="Nominal dollars" />
            <Stat
              label={result.totalWithdrawn > 0 ? "Total withdrawn" : "Growth share"}
              value={result.totalWithdrawn > 0 ? compactUsd(result.totalWithdrawn) : pct(result.finalValue > 0 ? Math.max(0, result.gains) / result.finalValue : 0, 0)}
              sub={result.totalWithdrawn > 0 ? "Nominal dollars" : "Of final value from growth"}
            />
          </div>

          {result.depleted && (
            <div className="mt-4">
              <Notice tone="warning">
                Under these assumptions, withdrawals empty the account in <strong>year {result.depletedYear}</strong>.
              </Notice>
            </div>
          )}

          <div className="mt-6 h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="year" {...axisProps} tickFormatter={(y: number) => `Yr ${y}`} minTickGap={24} />
                <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactUsd(v)} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof chartData)[number];
                    return (
                      <TooltipCard
                        title={`End of year ${p.year}${real ? " (today's dollars)" : ""}`}
                        rows={[
                          { label: "Total value", value: usd(p.value) },
                          { label: "Your money in (net)", value: usd(p.net), color: C.navy },
                          { label: "Growth", value: usd(p.value - p.net), color: C.copper },
                        ]}
                      />
                    );
                  }}
                />
                <Area type="monotone" dataKey="principal" stackId="1" stroke={C.navy} fill={C.navy} fillOpacity={0.85} isAnimationActive={false} />
                <Area type="monotone" dataKey="growth" stackId="1" stroke={C.copper} fill={C.copper} fillOpacity={0.55} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-navy" />Your money in (contributions minus withdrawals)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-copper/70" />Growth</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-navy">Year-by-year</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)}>
              {showTable ? "Hide table" : "Show table"}
            </Button>
          </div>
          {showTable && (
            <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-slate">
              <table className="num w-full min-w-[640px] text-right text-sm">
                <thead className="sticky top-0 bg-slate text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Year</th>
                    <th className="px-3 py-2">Added</th>
                    <th className="px-3 py-2">Withdrawn</th>
                    <th className="px-3 py-2">Growth</th>
                    <th className="px-3 py-2">End value</th>
                    <th className="px-3 py-2">Today&rsquo;s $</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.year} className="border-t border-slate">
                      <td className="px-3 py-2 text-left font-medium text-navy">{r.year}</td>
                      <td className="px-3 py-2">{usd(r.contributions)}</td>
                      <td className="px-3 py-2">{r.withdrawals ? usd(r.withdrawals) : "—"}</td>
                      <td className={`px-3 py-2 ${r.growth < 0 ? "text-negative" : ""}`}>{usd(r.growth)}</td>
                      <td className="px-3 py-2 font-semibold text-navy">{usd(r.endValue)}</td>
                      <td className="px-3 py-2 text-muted">{usd(r.endValueReal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Math matches Excel&rsquo;s FV function (monthly compounding, end-of-month contributions). Ignores taxes and fees.
          </p>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Notice, NumberField, Segmented, Spinner, Stat } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps, dateTicks } from "@/components/charts/theme";
import { useHistories } from "@/lib/client/data";
import { deleteSaved, listSaved, newId, upsertSaved, type Saved } from "@/lib/client/storage";
import { compactUsd, fmtDate, num, pct, price, usd } from "@/lib/format";
import { benchmark, branch, simulate, tickersOf, type Action, type SimResult, type Timeline } from "@/lib/timemachine";
import type { PriceHistory } from "@/lib/types";
import { ActionForm, DateField } from "./ActionForm";
import { describeAction } from "./describe";

const BENCH = "SPY";
const CURRENT_KEY = "wealthlab.tm.current.v1";
const SAVED_KEY = "wealthlab.tm.saved.v1";
const COLORS = [C.navy, C.copper, C.blue, "#6F8FAF", "#8A5A2B", C.positive];

interface Workspace {
  timelines: Timeline[];
  activeId: string;
}

function exampleWorkspace(): Workspace {
  const original: Timeline = {
    id: "orig",
    name: "Sold in the panic",
    startDate: "2020-01-02",
    endDate: "2024-12-31",
    startingCash: 10000,
    dividendMode: "reinvest",
    actions: [
      { id: "a1", type: "buy", date: "2020-01-02", ticker: "SPY", amount: { kind: "all" } },
      { id: "a2", type: "sell", date: "2020-03-16", ticker: "SPY", amount: { kind: "all" } },
      { id: "a3", type: "buy", date: "2020-08-03", ticker: "SPY", amount: { kind: "all" } },
    ],
  };
  const alt = branch(original, "alt", "Stayed invested");
  alt.actions = alt.actions.filter((a) => a.id === "a1");
  return { timelines: [original, alt], activeId: "orig" };
}

function loadCurrent(): Workspace {
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (raw) {
      const w = JSON.parse(raw) as Workspace;
      if (w.timelines?.length) return w;
    }
  } catch {}
  return exampleWorkspace();
}

export function Builder() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // action id being edited
  const [adding, setAdding] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [saved, setSaved] = useState<Saved<Workspace>[]>([]);
  const [saveName, setSaveName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setWs(loadCurrent());
    setSaved(listSaved<Workspace>(SAVED_KEY));
  }, []);
  useEffect(() => {
    if (!ws) return;
    try {
      window.localStorage.setItem(CURRENT_KEY, JSON.stringify(ws));
    } catch {}
  }, [ws]);

  const tickers = useMemo(() => {
    const s = new Set<string>([BENCH]);
    ws?.timelines.forEach((t) => tickersOf(t).forEach((x) => s.add(x)));
    return [...s];
  }, [ws]);
  const { loading, data, errors } = useHistories(tickers);

  const ready = !!ws && !loading && !!data[BENCH];
  const results = useMemo(() => {
    if (!ready || !ws) return null;
    const cal = data[BENCH].rows;
    const out: Record<string, { sim: SimResult; bench: SimResult }> = {};
    for (const t of ws.timelines) {
      const sim = simulate(t, data, cal);
      out[t.id] = { sim, bench: benchmark(sim.flows, t, data, cal, BENCH) };
    }
    return out;
  }, [ready, ws, data]);

  if (!ws) return <Card className="flex h-64 items-center justify-center"><Spinner label="Loading your timelines" /></Card>;

  const active = ws.timelines.find((t) => t.id === ws.activeId) ?? ws.timelines[0];
  const activeIndex = ws.timelines.indexOf(active);
  const lastDate = data[BENCH]?.lastDate ?? new Date().toISOString().slice(0, 10);
  const r = results?.[active.id];

  const updateActive = (patch: Partial<Timeline>) =>
    setWs((w) => w && { ...w, timelines: w.timelines.map((t) => (t.id === active.id ? { ...t, ...patch } : t)) });
  const setActions = (actions: Action[]) => updateActive({ actions });

  function copyActive() {
    if (!ws) return;
    if (ws.timelines.length >= 6) return setMsg("Up to 6 timelines at once.");
    const id = newId();
    const copy = branch(active, id, `${active.name} (alternate)`);
    setWs({ timelines: [...ws.timelines, copy], activeId: id });
    setMsg(`Copied "${active.name}". Edit any decision below; the original stays unchanged.`);
  }
  function removeActive() {
    if (!ws || ws.timelines.length <= 1) return;
    const rest = ws.timelines.filter((t) => t.id !== active.id);
    setWs({ timelines: rest, activeId: rest[0].id });
  }
  function saveWorkspace() {
    if (!ws) return;
    const name = saveName.trim() || `Time Machine ${saved.length + 1}`;
    const existing = saved.find((s) => s.name === name);
    const ok = upsertSaved(SAVED_KEY, { id: existing?.id ?? newId(), name, savedAt: new Date().toISOString(), data: ws });
    setSaved(listSaved(SAVED_KEY));
    setMsg(ok ? `Saved "${name}" in this browser.` : "Your browser blocked saving.");
  }

  const issueFor = (id: string) => r?.sim.issues.filter((i) => i.actionId === id) ?? [];
  const sortedActions = [...active.actions].map((a, i) => ({ a, i })).sort((x, y) => (x.a.date < y.a.date ? -1 : x.a.date > y.a.date ? 1 : x.i - y.i)).map((x) => x.a);
  const used = [...new Set([...tickersOf(active), "SPY", "QQQ", "AAPL"])].slice(0, 8);
  const failed = Object.entries(errors);

  return (
    <div className="space-y-6">
      {/* Timeline switcher */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Timelines</span>
          {ws.timelines.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setWs({ ...ws, activeId: t.id }); setEditing(null); setAdding(false); }}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                t.id === active.id ? "border-navy bg-navy text-white" : "border-slate-line bg-white text-charcoal hover:border-navy/40"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/60" style={{ background: COLORS[i % COLORS.length] }} />
              {t.name}
            </button>
          ))}
          <Button size="sm" variant="secondary" onClick={copyActive}>⧉ Copy &ldquo;{active.name}&rdquo; as an alternate</Button>
        </div>
        {msg && <p className="mt-3 text-xs text-positive">{msg}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* LEFT: setup + decisions */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: COLORS[activeIndex % COLORS.length] }} />
              <input
                value={active.name}
                onChange={(e) => updateActive({ name: e.target.value.slice(0, 40) })}
                aria-label="Timeline name"
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 font-serif text-xl text-navy outline-none focus:bg-slate/60"
              />
              {active.parentId && <Badge tone="copper">Alternate</Badge>}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DateField label="Start date" value={active.startDate} onChange={(v) => updateActive({ startDate: v })} min="1993-02-01" max={active.endDate} />
              <DateField label="End date" value={active.endDate} onChange={(v) => updateActive({ endDate: v })} min={active.startDate} max={lastDate} />
              <NumberField label="Starting cash" prefix="$" value={active.startingCash} onChange={(v) => updateActive({ startingCash: v })} min={0} step={1000} />
              <div>
                <span className="mb-1.5 block text-sm font-medium text-charcoal">Dividends</span>
                <Segmented
                  label="Dividend handling"
                  size="sm"
                  options={[{ value: "reinvest", label: "Reinvest" }, { value: "cash", label: "Take as cash" }]}
                  value={active.dividendMode}
                  onChange={(v) => updateActive({ dividendMode: v })}
                />
              </div>
            </div>
            {ws.timelines.length > 1 && (
              <div className="mt-4 text-right">
                <Button size="sm" variant="danger" onClick={removeActive}>Delete this timeline</Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-navy">Decisions</h3>
              {!adding && !editing && <Button size="sm" onClick={() => setAdding(true)}>+ Add decision</Button>}
            </div>
            {adding && (
              <div className="mt-4 rounded-xl border border-slate-line bg-ivory/70 p-4">
                <ActionForm
                  defaultDate={active.startDate}
                  minDate={active.startDate}
                  maxDate={active.endDate}
                  suggestions={used}
                  onCancel={() => setAdding(false)}
                  onSubmit={(a) => { setActions([...active.actions, { ...a, id: newId() } as Action]); setAdding(false); }}
                />
              </div>
            )}
            {sortedActions.length === 0 && !adding && <p className="mt-3 text-sm text-muted">No decisions yet. Your starting cash will just sit in cash.</p>}
            <ol className="mt-3 space-y-2">
              {sortedActions.map((a) => {
                const d = describeAction(a);
                const problems = issueFor(a.id);
                const ranOn = r?.sim.executedOn[a.id];
                if (editing === a.id)
                  return (
                    <li key={a.id} className="rounded-xl border border-blue/30 bg-ivory/70 p-4">
                      <ActionForm
                        initial={a}
                        defaultDate={a.date}
                        minDate={active.startDate}
                        maxDate={active.endDate}
                        suggestions={used}
                        onCancel={() => setEditing(null)}
                        onSubmit={(n) => { setActions(active.actions.map((x) => (x.id === a.id ? ({ ...n, id: a.id } as Action) : x))); setEditing(null); }}
                      />
                    </li>
                  );
                return (
                  <li key={a.id} className={`rounded-xl border px-3 py-2.5 ${problems.length ? "border-negative/30 bg-negative/5" : "border-slate-line/80 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="num text-xs text-muted">{fmtDate(a.date)}{ranOn && ranOn !== a.date ? ` → executed ${fmtDate(ranOn)}` : ""}</p>
                        <p className="font-medium text-charcoal">{d.title}</p>
                        <p className="text-xs text-muted">{d.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(a.id); setAdding(false); }}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => setActions(active.actions.filter((x) => x.id !== a.id))}>Remove</Button>
                      </div>
                    </div>
                    {problems.map((p) => (
                      <p key={p.message} className="mt-1.5 text-xs font-medium text-negative">Blocked: {p.message}</p>
                    ))}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <h3 className="font-serif text-lg text-navy">Save these timelines</h3>
            <p className="mt-1 text-xs text-muted">Saved <strong>only in this browser</strong>, not the cloud. Your current work is also kept automatically on this device.</p>
            <div className="mt-3 flex gap-2">
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name (e.g. Demo: 2020 crash)" aria-label="Save name" maxLength={60} className="min-w-0 flex-1 rounded-xl border border-slate-line bg-white px-3 py-2 text-sm outline-none focus:border-blue" />
              <Button size="sm" onClick={saveWorkspace}>Save</Button>
            </div>
            {saved.length > 0 && (
              <ul className="mt-3 divide-y divide-slate">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted">{s.data.timelines.length} timeline{s.data.timelines.length > 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="secondary" onClick={() => { setWs(structuredClone(s.data)); setSaveName(s.name); setMsg(`Loaded "${s.name}".`); }}>Load</Button>
                      <Button size="sm" variant="danger" onClick={() => { deleteSaved(SAVED_KEY, s.id); setSaved(listSaved(SAVED_KEY)); }}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-slate pt-3">
              <Button size="sm" variant="ghost" onClick={() => { setWs(exampleWorkspace()); setMsg("Restored the example: selling in the March 2020 panic vs. staying invested."); }}>
                Reset to the example
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT: results */}
        <div className="min-w-0 space-y-6">
          {failed.length > 0 && (
            <Notice tone="error">
              {failed.map(([t, e]) => <span key={t} className="block"><strong>{t}:</strong> {e}</span>)}
            </Notice>
          )}
          {!results && !failed.length && <Card className="flex h-72 items-center justify-center"><Spinner label="Loading real price history" /></Card>}
          {results && r && (
            <>
              <ResultsSummary t={active} r={r.sim} b={r.bench} />
              <ComparisonChart ws={ws} results={results} activeId={active.id} />
              <PositionsCard r={r.sim} histories={data} />
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg text-navy">Transaction ledger</h3>
                    <p className="text-xs text-muted">{r.sim.ledger.length} entries · every row checks that cash + holdings = total</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setShowLedger((v) => !v)}>{showLedger ? "Hide" : "Show"} ledger</Button>
                </div>
                {showLedger && <Ledger r={r.sim} />}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsSummary({ t, r, b }: { t: Timeline; r: SimResult; b: SimResult }) {
  const end = r.days.at(-1);
  const bEnd = b.days.at(-1);
  if (!end || !bEnd) return <Notice tone="warning">No trading days in this date range.</Notice>;
  const diff = end.total - bEnd.total;
  const gain = end.total - end.netDeposits;
  const balanced = r.ledger.every((e) => e.balanced) && r.cashReconciles;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-navy">{t.name}</h2>
          <p className="text-xs text-muted">{fmtDate(r.start)} – {fmtDate(r.end)} · real end-of-day prices · dividends {t.dividendMode === "reinvest" ? "reinvested" : "taken as cash"}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${balanced ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
          {balanced ? "✓ Books balance after every transaction" : "⚠ Accounting check failed"}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Final value" value={compactUsd(end.total)} sub={usd(end.total, 2)} />
        <Stat label="Holding SPY instead" value={compactUsd(bEnd.total)} sub="Same cash in & out, dividends reinvested" />
        <Stat label="Versus SPY" value={`${diff >= 0 ? "+" : "−"}${compactUsd(Math.abs(diff))}`} tone={diff >= 0 ? "positive" : "negative"} sub={pct(end.total / bEnd.total - 1, 1, true)} />
        <Stat label="Gain on your money" value={`${gain >= 0 ? "+" : "−"}${compactUsd(Math.abs(gain))}`} tone={gain >= 0 ? "accent" : "negative"} sub={`${usd(end.netDeposits)} net put in`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <p className="text-muted">Cash now <strong className="num block text-charcoal">{usd(end.cash, 2)}</strong></p>
        <p className="text-muted">Invested now <strong className="num block text-charcoal">{usd(end.holdings, 2)}</strong></p>
        <p className="text-muted">Dividends received <strong className="num block text-charcoal">{usd(r.dividendsReceived, 2)}</strong></p>
        <p className="text-muted">Realized gains from sales <strong className={`num block ${r.realizedGain < 0 ? "text-negative" : "text-charcoal"}`}>{usd(r.realizedGain, 2)}</strong></p>
      </div>
      {r.issues.length > 0 && (
        <div className="mt-4">
          <Notice tone="warning">
            <strong>{r.issues.length} decision{r.issues.length > 1 ? "s were" : " was"} blocked</strong> and not applied. See the red notes in the decision list.
          </Notice>
        </div>
      )}
      {r.stalePrices.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Data gap: {r.stalePrices.length} transaction{r.stalePrices.length > 1 ? "s" : ""} used the last available close because there was no price that day (e.g. {r.stalePrices[0].ticker} on {fmtDate(r.stalePrices[0].date)} used {fmtDate(r.stalePrices[0].priceDate)}).
        </p>
      )}
    </Card>
  );
}

function ComparisonChart({ ws, results, activeId }: { ws: Workspace; results: Record<string, { sim: SimResult; bench: SimResult }>; activeId: string }) {
  const [showBench, setShowBench] = useState(true);
  const activeIdx = ws.timelines.findIndex((t) => t.id === activeId);

  const { points, markers } = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    ws.timelines.forEach((t, i) => {
      for (const d of results[t.id].sim.days) {
        const p = map.get(d.date) ?? { date: d.date };
        p[`t${i}`] = d.total;
        map.set(d.date, p);
      }
    });
    for (const d of results[activeId].bench.days) {
      const p = map.get(d.date) ?? { date: d.date };
      p.bench = d.total;
      map.set(d.date, p);
    }
    // Transaction markers for every timeline (on its executed dates)
    const markers = new Map<string, { i: number; label: string }[]>();
    ws.timelines.forEach((t, i) => {
      const exec = results[t.id].sim.executedOn;
      for (const a of t.actions) {
        const d = exec[a.id];
        if (!d) continue;
        const list = markers.get(d) ?? [];
        list.push({ i, label: `${t.name}: ${describeAction(a).title}` });
        markers.set(d, list);
      }
    });
    const all = [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    // Downsample but always keep marker dates
    const step = Math.max(1, Math.ceil(all.length / 700));
    const pts = all.filter((p, k) => k % step === 0 || k === all.length - 1 || markers.has(String(p.date)));
    return { points: pts, markers };
  }, [ws, results, activeId]);

  const axis = useMemo(() => dateTicks(points.map((p) => String(p.date))), [points]);

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg text-navy">All timelines compared</h3>
          <p className="text-xs text-muted">Dots mark decisions. Hover or tap for values.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={showBench} onChange={(e) => setShowBench(e.target.checked)} className="h-4 w-4 accent-[#C77B39]" />
          Show &ldquo;just hold SPY&rdquo;
        </label>
      </div>
      <div className="mt-4 h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" {...axisProps} ticks={axis.ticks} interval={0} tickFormatter={axis.format} />
            <YAxis {...axisProps} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => compactUsd(v)} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Record<string, number | string>;
                const ms = markers.get(String(p.date)) ?? [];
                return (
                  <div>
                    <TooltipCard
                      title={fmtDate(String(p.date))}
                      rows={[
                        ...ws.timelines.map((t, i) => ({ label: t.name, value: p[`t${i}`] !== undefined ? usd(Number(p[`t${i}`])) : "—", color: COLORS[i % COLORS.length] })),
                        ...(showBench && p.bench !== undefined ? [{ label: "Hold SPY", value: usd(Number(p.bench)), color: "#9AA7B5" }] : []),
                      ]}
                    />
                    {ms.length > 0 && (
                      <div className="mt-1 rounded-lg border border-copper/30 bg-white px-3 py-2 text-xs text-charcoal shadow-card">
                        {ms.map((m) => <p key={m.label}>● {m.label}</p>)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {showBench && <Line dataKey="bench" stroke="#9AA7B5" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            {ws.timelines.map((t, i) => (
              <Line
                key={t.id}
                dataKey={`t${i}`}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={i === activeIdx ? 3 : 2}
                strokeOpacity={i === activeIdx ? 1 : 0.75}
                isAnimationActive={false}
                connectNulls
                dot={(props: { cx?: number; cy?: number; payload?: Record<string, unknown>; index?: number }) => {
                  const ms = markers.get(String(props.payload?.date));
                  const mine = ms?.some((m) => m.i === i);
                  if (!mine || props.cx === undefined || props.cy === undefined) return <g key={`d${i}-${props.index}`} />;
                  return <circle key={`d${i}-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill="#fff" stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} />;
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {ws.timelines.map((t, i) => {
          const end = results[t.id].sim.days.at(-1)?.total ?? 0;
          return (
            <span key={t.id} className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-5 rounded" style={{ background: COLORS[i % COLORS.length] }} />
              {t.name} <strong className="num text-charcoal">{compactUsd(end)}</strong>
            </span>
          );
        })}
        {showBench && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded" style={{ backgroundImage: "linear-gradient(90deg,#9AA7B5 60%,transparent 0)", backgroundSize: "6px 3px" }} />
            Hold SPY (same cash flows as {ws.timelines[activeIdx]?.name})
          </span>
        )}
      </div>
    </Card>
  );
}

function PositionsCard({ r, histories }: { r: SimResult; histories: Record<string, PriceHistory> }) {
  const end = r.days.at(-1);
  if (!end) return null;
  return (
    <Card>
      <h3 className="font-serif text-lg text-navy">Holdings on {fmtDate(r.end)}</h3>
      {r.positions.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No investments held, all {usd(end.cash, 2)} is in cash.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="num w-full min-w-[560px] text-right text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr><th className="py-2 text-left">Investment</th><th className="py-2">Shares</th><th className="py-2">Avg cost</th><th className="py-2">Price</th><th className="py-2">Value</th><th className="py-2">Unrealized</th></tr>
            </thead>
            <tbody>
              {r.positions.map((p) => {
                const ug = p.value - p.costBasis;
                return (
                  <tr key={p.ticker} className="border-t border-slate">
                    <td className="py-2 text-left"><span className="font-semibold text-navy">{p.ticker}</span> <span className="text-xs text-muted">{histories[p.ticker]?.name}</span></td>
                    <td className="py-2">{num(p.shares, 4)}</td>
                    <td className="py-2">{price(p.costBasis / p.shares)}</td>
                    <td className="py-2">{price(p.price)}</td>
                    <td className="py-2 font-semibold text-navy">{usd(p.value, 2)}</td>
                    <td className={`py-2 ${ug < 0 ? "text-negative" : "text-positive"}`}>{usd(ug, 2)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate">
                <td className="py-2 text-left font-medium">Cash</td><td /><td /><td /><td className="py-2 font-semibold text-navy">{usd(end.cash, 2)}</td><td />
              </tr>
              <tr className="border-t-2 border-navy/20">
                <td className="py-2 text-left font-semibold text-navy">Total</td><td /><td /><td /><td className="py-2 font-semibold text-navy">{usd(end.total, 2)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Average cost includes reinvested dividends. Share counts reflect all splits.</p>
    </Card>
  );
}

const TYPE_LABEL: Record<string, string> = { start: "Start", deposit: "Add cash", withdraw: "Withdraw", buy: "Buy", sell: "Sell", dividend: "Dividend", reinvest: "Reinvest", split: "Split" };

function Ledger({ r }: { r: SimResult }) {
  return (
    <div className="mt-4 max-h-[30rem] overflow-auto rounded-xl border border-slate">
      <table className="num w-full min-w-[820px] text-right text-xs sm:text-sm">
        <thead className="sticky top-0 bg-slate text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Ticker</th>
            <th className="px-3 py-2">Shares</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Cash effect</th>
            <th className="px-3 py-2">Cash after</th><th className="px-3 py-2">Total after</th><th className="px-3 py-2">Check</th>
          </tr>
        </thead>
        <tbody>
          {r.ledger.map((e, k) => (
            <tr key={k} className="border-t border-slate align-top">
              <td className="whitespace-nowrap px-3 py-2 text-left">{fmtDate(e.date)}</td>
              <td className="px-3 py-2 text-left">
                <span className="font-medium text-charcoal">{TYPE_LABEL[e.type]}</span>
                {e.note && <span className="block max-w-[16rem] text-[11px] font-normal text-muted">{e.note}</span>}
              </td>
              <td className="px-3 py-2 text-left font-semibold text-navy">{e.ticker ?? ""}</td>
              <td className="px-3 py-2">{e.shares ? num(e.shares, 4) : ""}</td>
              <td className="px-3 py-2">{e.price ? price(e.price) : ""}</td>
              <td className={`px-3 py-2 ${e.amount < 0 ? "text-negative" : e.amount > 0 ? "text-positive" : "text-muted"}`}>{e.amount ? usd(e.amount, 2) : "—"}</td>
              <td className="px-3 py-2">{usd(e.cashAfter, 2)}</td>
              <td className="px-3 py-2 font-medium text-navy">{usd(e.totalAfter, 2)}</td>
              <td className="px-3 py-2">{e.balanced ? <span className="text-positive">✓</span> : <span className="text-negative">✗</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

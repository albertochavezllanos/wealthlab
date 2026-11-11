"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Notice, Segmented, Spinner } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps } from "@/components/charts/theme";
import { useJson } from "@/lib/client/data";
import { fmtDate, fmtDateTime, pct, price } from "@/lib/format";
import type { Snapshot } from "@/lib/metrics";
import { Chg, CiteChips, SectionTitle, Sparkline, hostOf, sourceDate } from "./shared";

interface Batch { rows: Snapshot[]; pending: string[]; failed: { ticker: string; error: string }[]; rateLimited: boolean }
interface Pulse {
  sections: { heading: string; items: { text: string; cites: number[] }[] }[];
  sources: { n: number; title: string; url: string; date: string | null }[];
  removedUncited: number;
  generatedAt: string;
  model: string;
  searches: number;
}

const PERIODS = [
  { value: "chg1d", label: "1 day" },
  { value: "chg1m", label: "1 month" },
  { value: "ytd", label: "YTD" },
  { value: "r1y", label: "1 year" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["value"];

export function BatchNotice({ b, what }: { b: Batch; what: string }) {
  if (!b.pending.length && !b.failed.length) return null;
  return (
    <Notice tone="warning">
      {b.pending.length > 0 && (
        <span className="block">
          {b.pending.length} of {b.pending.length + b.rows.length + b.failed.length} {what} are waiting on the free data plan&rsquo;s hourly limit ({b.pending.join(", ")}). They&rsquo;ll load on a later visit; already-loaded data is cached.
        </span>
      )}
      {b.failed.map((f) => <span key={f.ticker} className="block"><strong>{f.ticker}:</strong> {f.error}</span>)}
    </Notice>
  );
}

export function MarketsPanel() {
  const idx = useJson<Batch>("/api/market?group=indexes");
  const sec = useJson<Batch>("/api/market?group=sectors");
  const [period, setPeriod] = useState<PeriodKey>("ytd");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Card>
          <SectionTitle sub="Tracked through the ETFs that follow each index · end-of-day closes, not real-time">Major indexes</SectionTitle>
          {idx.status === "loading" && <div className="flex h-40 items-center justify-center"><Spinner label="Loading index data" /></div>}
          {idx.status === "error" && <div className="mt-4"><Notice tone="error">{idx.error}</Notice></div>}
          {idx.status === "ready" && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {idx.data.rows.map((r) => (
                  <div key={r.ticker} className="rounded-xl border border-slate-line/70 bg-ivory/50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-charcoal">{r.name}</p>
                        <p className="text-xs text-muted">{r.ticker} · close {fmtDate(r.date)}</p>
                      </div>
                      <Sparkline values={r.spark} width={84} height={28} />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="num font-serif text-2xl text-navy">{price(r.close)}</span>
                      <Chg v={r.chg1d} digits={2} className="text-sm font-semibold" />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-muted">
                      <span>1M <Chg v={r.chg1m} /></span><span>YTD <Chg v={r.ytd} /></span><span>1Y <Chg v={r.r1y} /></span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3"><BatchNotice b={idx.data} what="indexes" /></div>
            </>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle sub="S&P 500 sector ETFs (Select Sector SPDRs), price change">Sector performance</SectionTitle>
            <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
          </div>
          {sec.status === "loading" && <div className="flex h-60 items-center justify-center"><Spinner label="Loading sectors" /></div>}
          {sec.status === "error" && <div className="mt-4"><Notice tone="error">{sec.error}</Notice></div>}
          {sec.status === "ready" && (
            <>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...sec.data.rows].map((r) => ({ name: r.name, ticker: r.ticker, v: (r[period] as number | null) ?? 0, date: r.date })).sort((a, b) => b.v - a.v)}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v: number) => pct(v, 0)} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={150} tick={{ fill: C.charcoal, fontSize: 12 }} />
                    <Tooltip cursor={{ fill: "rgba(36,99,154,0.06)" }} content={({ active, payload }) => (active && payload?.length ? <TooltipCard title={`${payload[0].payload.name} (${payload[0].payload.ticker})`} rows={[{ label: PERIODS.find((p) => p.value === period)!.label, value: pct(Number(payload[0].value), 2, true) }, { label: "As of close", value: fmtDate(payload[0].payload.date) }]} /> : null)} />
                    <Bar dataKey="v" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {[...sec.data.rows].map((r) => ({ v: (r[period] as number | null) ?? 0 })).sort((a, b) => b.v - a.v).map((d, i) => <Cell key={i} fill={d.v >= 0 ? C.blue : C.copper} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3"><BatchNotice b={sec.data} what="sectors" /></div>
              {sec.data.rows[0] && <p className="mt-2 text-xs text-muted">Source: Tiingo end-of-day · as of close {fmtDate(sec.data.rows[0].date)}</p>}
            </>
          )}
        </Card>
      </div>

      <PulseCard />
    </div>
  );
}

function PulseCard() {
  const [on, setOn] = useState(true);
  const p = useJson<Pulse>(on ? "/api/pulse" : null);
  return (
    <Card className="min-w-0 self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="font-serif text-xl text-navy">Market Pulse</h2><Badge tone="copper">AI briefing</Badge></div>
          <p className="mt-0.5 text-xs text-muted">Written by AI from a live web search. Every item links to its sources. Refreshed about every 3 hours.</p>
        </div>
      </div>
      {p.status === "loading" && (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-center">
          <Spinner label="Searching the web and writing today's briefing" />
          <p className="max-w-xs text-xs text-muted">This can take 20–40 seconds the first time. Later visits load instantly from the cache.</p>
        </div>
      )}
      {p.status === "error" && (
        <div className="mt-4 space-y-3">
          <Notice tone="error">{p.error}</Notice>
          <Button size="sm" variant="secondary" onClick={() => { setOn(true); p.reload(); }}>Try again</Button>
        </div>
      )}
      {p.status === "ready" && (
        <>
          <div className="mt-4 space-y-5">
            {p.data.sections.map((s) => (
              <article key={s.heading}>
                <h3 className="font-serif text-lg leading-snug text-navy">{s.heading}</h3>
                {s.items.map((i, k) => (
                  <p key={k} className="mt-1 text-sm leading-relaxed text-charcoal">{i.text}<CiteChips ids={i.cites} prefix="pulse-src" /></p>
                ))}
              </article>
            ))}
          </div>
          <div className="mt-6 border-t border-slate pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Sources</p>
            <ol className="mt-2 space-y-1.5 text-xs">
              {p.data.sources.map((s) => (
                <li key={s.n} id={`pulse-src-${s.n}`} className="flex gap-2 scroll-mt-28">
                  <span className="num w-5 shrink-0 text-right font-semibold text-blue">{s.n}</span>
                  <span className="min-w-0">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-charcoal underline decoration-slate-line underline-offset-2 hover:text-blue">{s.title}</a>
                    <span className="block text-muted">{hostOf(s.url)} · {sourceDate(s.date, p.data.generatedAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              Generated {fmtDateTime(p.data.generatedAt)} by {p.data.model} using {p.data.searches} web searches.
              {p.data.removedUncited > 0 && ` ${p.data.removedUncited} uncited item(s) were removed automatically.`} AI summaries can contain mistakes; check the linked sources.
              Not investment advice.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

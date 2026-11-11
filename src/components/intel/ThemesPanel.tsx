"use client";

import { useState } from "react";
import { Button, Notice, Spinner } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { useJson } from "@/lib/client/data";
import { fmtDate, fmtDateTime, pct, price } from "@/lib/format";
import type { Snapshot } from "@/lib/metrics";
import { THEMES } from "@/lib/themes";
import { Chg, CiteChips, Sparkline, hostOf, sourceDate } from "./shared";
import { BatchNotice } from "./MarketsPanel";

interface Research {
  sections: { heading: string; items: { text: string; cites: number[] }[] }[];
  sources: { n: number; title: string; url: string; date: string | null }[];
  removedUncited: number;
  generatedAt: string;
  model: string;
}
interface Batch { rows: Snapshot[]; pending: string[]; failed: { ticker: string; error: string }[]; rateLimited: boolean }

export function ThemesPanel() {
  const [id, setId] = useState<string | null>(null);
  const theme = THEMES.find((t) => t.id === id) ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl text-navy">Future Themes Lab</h2>
          <Badge tone="copper">Research shortlists, not recommendations</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Six long-term trends that could shape the next 15–20 years. For each: cited evidence, what has to go right, what could go wrong, and investments with exposure to it, shown with real data and risk measures.
          A real trend doesn&rsquo;t guarantee good returns (see the tech-bubble replay in the Time Machine).
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setId(t.id)}
              className={`rounded-2xl border p-4 text-left transition ${t.id === id ? "border-navy bg-navy text-white shadow-lift" : "border-slate-line bg-white hover:-translate-y-0.5 hover:border-navy/40"}`}
            >
              <span className={`num font-serif text-sm ${t.id === id ? "text-copper-soft" : "text-copper"}`}>0{i + 1}</span>
              <p className="mt-1 font-serif text-lg">{t.title}</p>
              <p className={`mt-1 text-xs leading-relaxed ${t.id === id ? "text-white/75" : "text-muted"}`}>{t.oneLiner}</p>
            </button>
          ))}
        </div>
      </Card>

      {theme && <ThemeDetail key={theme.id} id={theme.id} />}
    </div>
  );
}

function ThemeDetail({ id }: { id: string }) {
  const theme = THEMES.find((t) => t.id === id)!;
  const research = useJson<Research>(`/api/theme?id=${id}`);
  const market = useJson<Batch>(`/api/theme?id=${id}&part=market`);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="min-w-0">
        <h3 className="font-serif text-2xl text-navy">{theme.title}</h3>
        <p className="mt-1 text-sm text-muted">{theme.oneLiner}</p>
        {research.status === "loading" && (
          <div className="flex h-60 flex-col items-center justify-center gap-2 text-center">
            <Spinner label="Searching for evidence and writing a cited summary" />
            <p className="max-w-xs text-xs text-muted">20–40 seconds the first time; saved for a week after that.</p>
          </div>
        )}
        {research.status === "error" && (
          <div className="mt-4 space-y-3"><Notice tone="error">{research.error}</Notice><Button size="sm" variant="secondary" onClick={research.reload}>Try again</Button></div>
        )}
        {research.status === "ready" && (
          <>
            {research.data.sections.map((s) => {
              const isEvidence = /evidence/i.test(s.heading);
              const tone = isEvidence ? "bg-navy" : /right/i.test(s.heading) ? "bg-positive" : "bg-negative";
              return (
                <section key={s.heading} className="mt-5">
                  <div className="flex items-center gap-2"><span className={`h-4 w-1 rounded ${tone}`} /><h4 className="font-serif text-lg text-navy">{s.heading}</h4></div>
                  {!isEvidence && <p className="ml-3 text-xs text-muted">Analysis; cited where it relies on facts.</p>}
                  <ul className="mt-2 space-y-2">
                    {s.items.map((i, k) => <li key={k} className="ml-3 text-sm leading-relaxed text-charcoal">{i.text}<CiteChips ids={i.cites} prefix={`th-${id}`} /></li>)}
                  </ul>
                </section>
              );
            })}
            <div className="mt-6 border-t border-slate pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Sources</p>
              <ol className="mt-2 space-y-1.5 text-xs">
                {research.data.sources.map((s) => (
                  <li key={s.n} id={`th-${id}-${s.n}`} className="flex scroll-mt-28 gap-2">
                    <span className="num w-5 shrink-0 text-right font-semibold text-blue">{s.n}</span>
                    <span className="min-w-0">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-charcoal underline decoration-slate-line underline-offset-2 hover:text-blue">{s.title}</a>
                      <span className="block text-muted">{hostOf(s.url)} · {sourceDate(s.date, research.data.generatedAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-muted">Researched {fmtDateTime(research.data.generatedAt)} by {research.data.model} with web search.{research.data.removedUncited > 0 && ` ${research.data.removedUncited} uncited evidence item(s) removed automatically.`} AI summaries can contain mistakes; check the sources.</p>
            </div>
          </>
        )}
      </Card>

      <Card className="min-w-0 self-start">
        <h3 className="font-serif text-lg text-navy">Investments with exposure</h3>
        <p className="text-xs text-muted">A research shortlist to study further, not recommendations. Exposure doesn&rsquo;t mean the investment will benefit.</p>
        {market.status === "loading" && <div className="flex h-40 items-center justify-center"><Spinner label="Loading real price data" /></div>}
        {market.status === "error" && <div className="mt-3"><Notice tone="error">{market.error}</Notice></div>}
        {market.status === "ready" && (
          <>
            <div className="mt-3 space-y-3">
              {theme.exposures.map((e) => {
                const s = market.data.rows.find((r) => r.ticker === e.ticker);
                return (
                  <div key={e.ticker} className="rounded-xl border border-slate-line/70 bg-ivory/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p><span className="font-semibold text-navy">{e.ticker}</span> <span className="text-sm text-charcoal">{e.name}</span> <Badge>{e.assetType}</Badge></p>
                        <p className="text-xs text-muted">{e.why}</p>
                      </div>
                      {s && <Sparkline values={s.spark} width={72} height={24} />}
                    </div>
                    {s ? (
                      <div className="num mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                        <span className="text-muted">Price <strong className="block text-sm text-charcoal">{price(s.close)}</strong></span>
                        <span className="text-muted">1-yr return <strong className="block text-sm"><Chg v={s.r1y} /></strong></span>
                        <span className="text-muted">Volatility <strong className="block text-sm text-charcoal">{pct(s.vol1y ?? NaN, 0)}</strong></span>
                        <span className="text-muted">Max drawdown (5y) <strong className="block text-sm text-negative">{pct(s.mdd5y ?? NaN, 0)}</strong></span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">Data not loaded yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3"><BatchNotice b={market.data} what="investments" /></div>
            {market.data.rows[0] && <p className="mt-2 text-xs text-muted">Source: Tiingo end-of-day, close {fmtDate(market.data.rows[0].date)}. Returns include dividends. Expense ratios not shown (no verified free source).</p>}
          </>
        )}
      </Card>
    </div>
  );
}

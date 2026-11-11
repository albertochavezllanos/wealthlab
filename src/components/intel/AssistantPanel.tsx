"use client";

import { useState } from "react";
import { Button, Notice, Spinner } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { getJson, FetchError } from "@/lib/client/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CiteChips } from "./shared";

interface Cited { text: string; sources: string[] }
interface Answer {
  question: string; tickers: string[]; summary: string; facts: Cited[]; interpretation: Cited[]; risks: Cited[];
  missingData: string[]; sources: { id: string; label: string; url?: string; date?: string }[];
  removedUncited: number; generatedAt: string; model: string; notice?: string; degraded: boolean;
}
type Resp = Answer | { needTickers: true; message: string };

const EXAMPLES = [
  "Compare Nvidia, Microsoft, and Apple",
  "How do Visa and Mastercard differ in growth and margins?",
  "What are the main risks for Tesla based on its numbers?",
  "Compare JPMorgan and Bank of America",
];

export function AssistantPanel() {
  const [q, setQ] = useState(EXAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(question = q) {
    const text = question.trim();
    if (!text || busy) return; // one request at a time: never double-calls the AI
    setBusy(true);
    setError(null);
    setResp(null);
    try {
      setResp(await getJson<Resp>(`/api/assistant?q=${encodeURIComponent(text.replace(/\s+/g, " "))}`));
    } catch (e) {
      setError(e instanceof FetchError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card className="self-start">
        <div className="flex items-center gap-2"><h2 className="font-serif text-xl text-navy">Ask the research assistant</h2></div>
        <p className="mt-1 text-sm text-muted">Name up to 4 companies. It retrieves SEC filings and price history first, then answers only from that data, with sources for every fact.</p>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-4 space-y-3">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={400}
            rows={3}
            aria-label="Your question"
            className="w-full resize-none rounded-xl border border-slate-line bg-white px-3 py-2.5 text-base text-charcoal outline-none focus:border-blue focus:ring-2 focus:ring-blue/15"
          />
          <Button type="submit" disabled={busy || !q.trim()}>{busy ? "Researching…" : "Ask"}</Button>
        </form>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Try</p>
        <div className="mt-2 flex flex-col items-start gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" disabled={busy} onClick={() => { setQ(e); ask(e); }} className="rounded-lg px-2 py-1 text-left text-sm text-blue hover:bg-slate disabled:opacity-50">{e} →</button>
          ))}
        </div>
        <p className="mt-5 text-[11px] leading-relaxed text-muted">The assistant never predicts prices or tells you to buy or sell. Repeat questions are answered from a cache, so they&rsquo;re instant and cost nothing.</p>
      </Card>

      <div className="min-w-0">
        {busy && (
          <Card className="flex h-72 flex-col items-center justify-center gap-2 text-center">
            <Spinner label="Retrieving filings and prices, then writing a sourced answer" />
            <p className="max-w-sm text-xs text-muted">Usually 15–40 seconds for a new question.</p>
          </Card>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {resp && "needTickers" in resp && <Notice tone="info">{resp.message}</Notice>}
        {resp && !("needTickers" in resp) && <AnswerView a={resp} />}
        {!busy && !resp && !error && (
          <Card className="flex h-72 items-center justify-center text-center">
            <p className="max-w-sm text-sm text-muted">Ask a question to see a sourced answer, with facts, interpretation, and risks kept clearly separate.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Block({ title, tone, items, note }: { title: string; tone: "navy" | "copper" | "negative"; items: Cited[]; note: string }) {
  if (!items.length) return null;
  const bar = { navy: "bg-navy", copper: "bg-copper", negative: "bg-negative" }[tone];
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <span className={`h-4 w-1 rounded ${bar}`} />
        <h3 className="font-serif text-lg text-navy">{title}</h3>
      </div>
      <p className="ml-3 text-xs text-muted">{note}</p>
      <ul className="mt-2 space-y-2">
        {items.map((f, i) => (
          <li key={i} className="ml-3 text-sm leading-relaxed text-charcoal">
            {f.text}<CiteChips ids={f.sources} prefix="ans-src" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnswerView({ a }: { a: Answer }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="copper">AI answer from retrieved data</Badge>
        {a.tickers.map((t) => <Badge key={t} tone="navy">{t}</Badge>)}
      </div>
      <p className="mt-3 font-serif text-lg leading-relaxed text-navy">{a.summary}</p>
      {a.notice && <div className="mt-3"><Notice tone="info">{a.notice}</Notice></div>}
      <Block title="Facts" tone="navy" items={a.facts} note="Taken directly from the retrieved data. Each one shows its sources." />
      <Block title="Interpretation" tone="copper" items={a.interpretation} note="The assistant's analysis of what the facts suggest. Opinion, not fact." />
      <Block title="Risks to consider" tone="negative" items={a.risks} note="Uncertainties visible in the data." />
      {a.missingData.length > 0 && (
        <section className="mt-6 rounded-xl bg-slate/60 p-4">
          <h3 className="text-sm font-semibold text-charcoal">Missing or limited data</h3>
          <ul className="mt-1 space-y-1 text-xs text-muted">{a.missingData.map((m) => <li key={m}>• {m}</li>)}</ul>
        </section>
      )}
      <section className="mt-6 border-t border-slate pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Sources</p>
        <ol className="mt-2 space-y-1 text-xs">
          {a.sources.map((s) => (
            <li key={s.id} id={`ans-src-${s.id}`} className="scroll-mt-28">
              <span className="mr-2 font-semibold text-blue">{s.id}</span>
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-charcoal underline decoration-slate-line underline-offset-2 hover:text-blue">{s.label}</a> : <span className="text-charcoal">{s.label}</span>}
              {s.date && <span className="text-muted"> · {fmtDate(s.date)}</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-muted">
          Generated {fmtDateTime(a.generatedAt)} by {a.model}.{a.removedUncited > 0 && ` ${a.removedUncited} statement(s) without a valid source were removed automatically.`}
          {a.degraded && " Some data was temporarily unavailable, so this answer wasn't saved; ask again later for a complete one."} Educational only, not investment advice.
        </p>
      </section>
    </Card>
  );
}

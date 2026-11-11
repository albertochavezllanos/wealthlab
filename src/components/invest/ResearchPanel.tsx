"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TickerSearch } from "@/components/TickerSearch";
import { Notice, Segmented, Spinner, Stat } from "@/components/form";
import { Badge, Card } from "@/components/ui";
import { C, TooltipCard, axisProps, downsample } from "@/components/charts/theme";
import { useHistory } from "@/lib/client/data";
import { fmtDate, fmtDateTime, pct, price, usd } from "@/lib/format";
import {
  RANGES,
  annualizedVolatility,
  indexOnOrAfter,
  maxDrawdown,
  periodsPerYear,
  rangeStart,
  splitAdjustedCloses,
  splitAdjustedDividends,
  type RangeKey,
} from "@/lib/metrics";

const QUICK = ["SPY", "AAPL", "NVDA", "VOO", "VFIAX", "BTCUSD"];

export function ResearchPanel() {
  const [ticker, setTicker] = useState("SPY");
  const [range, setRange] = useState<RangeKey>("1Y");
  const state = useHistory(ticker);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <TickerSearch onSelect={(r) => setTicker(r.ticker)} />
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTicker(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                t === ticker ? "border-navy bg-navy text-white" : "border-slate-line bg-white text-navy hover:border-navy/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {state.status === "loading" && (
        <Card className="flex h-80 items-center justify-center">
          <Spinner label={`Loading ${ticker} price history`} />
        </Card>
      )}
      {state.status === "error" && (
        <Notice tone="error">
          <strong>{ticker}:</strong> {state.error}
        </Notice>
      )}
      {state.status === "ready" && <QuoteView h={state.data} range={range} setRange={setRange} />}
    </div>
  );
}

function QuoteView({
  h,
  range,
  setRange,
}: {
  h: import("@/lib/types").PriceHistory;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
}) {
  const view = useMemo(() => {
    const adj = splitAdjustedCloses(h.rows);
    const start = indexOnOrAfter(h.rows, rangeStart(h.lastDate, range));
    const from = Math.min(start, h.rows.length - 1);
    const slice = h.rows.slice(from);
    const prices = adj.slice(from);
    const points = slice.map((r, i) => ({ date: r[0], price: prices[i] }));
    const first = prices[0];
    const last = prices[prices.length - 1];
    const tr = slice[slice.length - 1][2] / slice[0][2] - 1;
    const last1y = indexOnOrAfter(h.rows, rangeStart(h.lastDate, "1Y"));
    const yearAdj = adj.slice(last1y);
    const divs12m = splitAdjustedDividends(h.rows).slice(last1y).reduce((s, d) => s + d, 0);
    const splits = slice.filter((r) => r[4] !== 1).map((r) => ({ date: r[0], factor: r[4] }));
    const n = h.rows.length;
    // If the latest day was a split day, put the prior close on the new share basis
    const prevClose = n > 1 ? h.rows[n - 2][1] / (h.rows[n - 1][4] || 1) : NaN;
    return {
      points: downsample(points, 700),
      first,
      last,
      priceChange: last / first - 1,
      totalReturn: tr,
      lastRaw: h.rows[n - 1][1],
      dayChange: h.rows[n - 1][1] / prevClose - 1,
      high52: Math.max(...yearAdj),
      low52: Math.min(...yearAdj),
      vol: annualizedVolatility(yearAdj, periodsPerYear(h)),
      dd: maxDrawdown(prices),
      divs12m,
      splits,
      fromDate: slice[0][0],
    };
  }, [h, range]);

  const up = view.priceChange >= 0;
  const color = up ? C.positive : C.negative;
  const isCrypto = h.assetType === "Crypto";

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6 pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl text-navy">{h.name}</h2>
            <Badge tone="navy">{h.ticker}</Badge>
            <Badge>{h.assetType}</Badge>
          </div>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <span className="num font-serif text-4xl text-navy">{price(view.lastRaw)}</span>
            {Number.isFinite(view.dayChange) && (
              <span className={`num text-sm font-semibold ${view.dayChange >= 0 ? "text-positive" : "text-negative"}`}>
                {pct(view.dayChange, 2, true)} vs prior close
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {isCrypto ? "Daily close (UTC)" : "End-of-day close"} on <strong className="text-charcoal">{fmtDate(h.lastDate)}</strong> ·
            not real-time
          </p>
        </div>
        <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} size="sm" />
      </div>

      <div className="px-2 sm:px-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pb-2 text-sm">
          <span className="text-muted">
            Price change since {fmtDate(view.fromDate)}:{" "}
            <strong className={`num ${up ? "text-positive" : "text-negative"}`}>{pct(view.priceChange, 1, true)}</strong>
          </span>
          {!isCrypto && (
            <span className="text-muted">
              Total return incl. dividends:{" "}
              <strong className={`num ${view.totalReturn >= 0 ? "text-positive" : "text-negative"}`}>{pct(view.totalReturn, 1, true)}</strong>
            </span>
          )}
        </div>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="px-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="date"
                {...axisProps}
                minTickGap={48}
                tickFormatter={(d: string) =>
                  ["1M", "6M", "YTD"].includes(range)
                    ? fmtDate(d).replace(/, \d{4}$/, "")
                    : range === "1Y"
                      ? `${fmtDate(d).slice(0, 3)} '${d.slice(2, 4)}`
                      : d.slice(0, 4)
                }
              />
              <YAxis
                {...axisProps}
                width={64}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toFixed(v < 10 ? 2 : 0)}`)}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipCard
                      title={fmtDate(String(payload[0].payload.date))}
                      rows={[{ label: "Close (split-adjusted)", value: price(Number(payload[0].value)) }]}
                    />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#px-fill)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 pt-4 md:grid-cols-4">
        <Stat label="52-week range" value={<span className="text-xl">{price(view.low52)} – {price(view.high52)}</span>} sub="Split-adjusted closes" />
        <Stat label="Volatility (1Y)" value={pct(view.vol)} sub="Annualized swing in daily returns" />
        <Stat label={`Max drawdown (${range})`} value={pct(view.dd.pct)} tone={view.dd.pct < -0.2 ? "negative" : "default"} sub="Largest peak-to-trough fall" />
        {isCrypto ? (
          <Stat label="Dividends" value="None" sub="Crypto assets don't pay dividends" />
        ) : (
          <Stat
            label="Dividends (12 mo)"
            value={view.divs12m > 0 ? usd(view.divs12m, view.divs12m < 0.1 ? 3 : 2) : "None"}
            sub={view.divs12m > 0 ? `${pct(view.divs12m / view.lastRaw, 2)} trailing yield, per share` : "No dividends paid in the last year"}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate px-6 py-3 text-xs text-muted">
        <span>
          Source: {h.source} · history from {fmtDate(h.firstDate)} · fetched {fmtDateTime(h.fetchedAt)}
        </span>
        {view.splits.length > 0 && (
          <span>
            Splits in range:{" "}
            {view.splits.map((s) => `${s.factor >= 1 ? `${s.factor}-for-1` : `1-for-${Math.round(1 / s.factor)}`} on ${fmtDate(s.date)}`).join(", ")}
            {" "}(chart adjusted)
          </span>
        )}
      </div>
    </Card>
  );
}

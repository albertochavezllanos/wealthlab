"use client";

import type { ReactNode } from "react";
import { fmtDate, pct } from "@/lib/format";

/** Colored percent change */
export function Chg({ v, digits = 1, className = "" }: { v: number | null | undefined; digits?: number; className?: string }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <span className={`text-muted ${className}`}>—</span>;
  return <span className={`num ${v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-charcoal"} ${className}`}>{pct(v, digits, true)}</span>;
}

export function Sparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={up ? "#2F7A55" : "#B0413E"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Superscript citation chips linking to numbered sources on the same page. */
export function CiteChips({ ids, prefix }: { ids: (number | string)[]; prefix: string }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-0.5 align-super">
      {ids.map((id) => (
        <a key={id} href={`#${prefix}-${id}`} className="rounded bg-blue/10 px-1 text-[10px] font-semibold leading-4 text-blue hover:bg-blue hover:text-white">
          {typeof id === "number" ? id : id}
        </a>
      ))}
    </span>
  );
}

/**
 * Turn a search result's page age ("3 days ago", "Nov 10, 2026", ...) into a readable date,
 * relative to when the briefing was generated.
 */
export function sourceDate(pageAge: string | null, generatedAt: string): string {
  if (!pageAge) return "date not provided";
  const m = pageAge.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/i);
  if (m) {
    const n = Number(m[1]);
    const unit = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2.63e9, year: 3.156e10 }[m[2].toLowerCase() as "day"];
    const d = new Date(Date.parse(generatedAt) - n * unit);
    return fmtDate(d.toISOString().slice(0, 10));
  }
  const t = Date.parse(pageAge);
  return Number.isFinite(t) ? fmtDate(new Date(t).toISOString().slice(0, 10)) : pageAge;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl text-navy">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

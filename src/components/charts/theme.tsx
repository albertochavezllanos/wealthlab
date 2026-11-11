"use client";

import type { ReactNode } from "react";

export const C = {
  navy: "#123A63",
  blue: "#24639A",
  copper: "#C77B39",
  charcoal: "#263445",
  slate: "#E8EEF3",
  grid: "#E3E9EF",
  muted: "#5B6878",
  positive: "#2F7A55",
  negative: "#B0413E",
  series: ["#123A63", "#C77B39", "#24639A", "#6F8FAF", "#8A5A2B", "#2F7A55", "#9AA7B5"],
};

export const axisProps = {
  stroke: C.muted,
  tick: { fill: C.muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Card-style tooltip used by every chart. */
export function TooltipCard({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-slate-line bg-white px-3.5 py-2.5 text-xs shadow-lift">
      <p className="mb-1.5 font-semibold text-navy">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="num flex items-center justify-between gap-6 py-0.5 text-charcoal">
          <span className="inline-flex items-center gap-1.5">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Reduce a long series to at most `max` points for smooth rendering (always keeps first and last). */
export function downsample<T>(arr: T[], max = 700): T[] {
  if (arr.length <= max) return arr;
  const step = (arr.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-5 rounded"
            style={i.dashed ? { backgroundImage: `linear-gradient(90deg, ${i.color} 60%, transparent 0)`, backgroundSize: "6px 2px" } : { background: i.color, height: 3 }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

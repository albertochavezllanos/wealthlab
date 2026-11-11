"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * Number input that lets people type freely (including clearing the box)
 * and only reports valid numbers upward.
 */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min,
  max,
  hint,
  ariaLabel,
}: {
  label: string;
  ariaLabel?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => {
    // Sync when the value changes from outside (e.g. loading a scenario)
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label htmlFor={id} className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-charcoal">{label}</span>}
      <span className="flex items-center rounded-xl border border-slate-line bg-white px-3 transition focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/15">
        {prefix && <span className="mr-1 text-sm text-muted">{prefix}</span>}
        <input
          id={id}
          aria-label={ariaLabel}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(n)) {
              const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
              onChange(clamped);
            }
          }}
          onBlur={() => setText(String(value))}
          className="num w-full bg-transparent py-2.5 text-base text-charcoal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="ml-1 whitespace-nowrap text-sm text-muted">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: readonly { value: T; label: string }[] | readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o as T, label: o as string } : o,
  );
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-slate p-1">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full font-medium transition ${size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${
            value === o.value ? "bg-white text-navy shadow-card" : "text-muted hover:text-charcoal"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-charcoal">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-navy" : "bg-slate-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm" | "md";
}) {
  const styles = {
    primary: "bg-navy text-white hover:bg-blue",
    secondary: "border border-slate-line bg-white text-navy hover:border-navy/40",
    ghost: "text-blue hover:bg-slate",
    danger: "text-negative hover:bg-negative/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"
      } ${styles}`}
    >
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  const color = { default: "text-navy", positive: "text-positive", negative: "text-negative", accent: "text-copper" }[tone];
  return (
    <div className="rounded-xl border border-slate-line/70 bg-white px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={`num mt-1 font-serif text-2xl ${color}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const s = {
    info: "border-blue/20 bg-blue/5 text-charcoal",
    warning: "border-copper/30 bg-copper-soft/50 text-charcoal",
    error: "border-negative/25 bg-negative/5 text-negative",
  }[tone];
  return <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${s}`}>{children}</div>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-line border-t-blue" />
      {label}…
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { TickerSearch } from "@/components/TickerSearch";
import { Button, NumberField, Segmented } from "@/components/form";
import type { Action, ActionInput, Amount } from "@/lib/timemachine";
import { ACTION_LABEL } from "./describe";

type Kind = Action["type"];
type AmountKind = Amount["kind"];

const BUY_KINDS = [
  { value: "dollars", label: "Dollars" },
  { value: "shares", label: "Shares" },
  { value: "percent", label: "% of cash" },
  { value: "all", label: "All cash" },
] as const;
const SELL_KINDS = [
  { value: "all", label: "Everything" },
  { value: "percent", label: "% of position" },
  { value: "shares", label: "Shares" },
  { value: "dollars", label: "Dollars" },
] as const;

export function DateField({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-charcoal">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="num w-full rounded-xl border border-slate-line bg-white px-3 py-2.5 text-base text-charcoal outline-none focus:border-blue focus:ring-2 focus:ring-blue/15"
      />
    </label>
  );
}

function TickerPick({ label, value, onChange, suggestions }: { label: string; value: string; onChange: (t: string) => void; suggestions: string[] }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-charcoal">{label}</span>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-line bg-white px-3 py-2">
          <span className="font-semibold text-navy">{value}</span>
          <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-blue hover:text-navy">Change</button>
        </div>
      ) : (
        <>
          <TickerSearch compact onSelect={(r) => onChange(r.ticker)} placeholder="Search ticker or name" />
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onChange(s)} className="rounded-full border border-slate-line bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:border-navy/40">
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Add or edit one decision in a timeline. */
export function ActionForm({
  initial,
  defaultDate,
  minDate,
  maxDate,
  suggestions,
  onSubmit,
  onCancel,
}: {
  initial?: Action;
  defaultDate: string;
  minDate: string;
  maxDate: string;
  suggestions: string[];
  onSubmit: (a: ActionInput) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<Kind>(initial?.type ?? "buy");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [ticker, setTicker] = useState(initial && "ticker" in initial ? initial.ticker : "");
  const [toTicker, setToTicker] = useState(initial?.type === "switch" ? initial.toTicker : "");
  const [amountKind, setAmountKind] = useState<AmountKind>(initial && "amount" in initial ? initial.amount.kind : "dollars");
  const [amountValue, setAmountValue] = useState(initial && "amount" in initial && "value" in initial.amount ? initial.amount.value : 1000);
  const [cashValue, setCashValue] = useState(initial && "value" in initial ? initial.value : 500);
  const [endDate, setEndDate] = useState(initial?.type === "recurring" ? initial.endDate ?? "" : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sensible amount type when switching between buy and sell
    if ((type === "sell" || type === "switch") && amountKind === "dollars" && !initial) setAmountKind("all");
    if (type === "buy" && amountKind === "all" && !initial) setAmountKind("dollars");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function submit() {
    setError(null);
    const amount: Amount = amountKind === "all" ? { kind: "all" } : { kind: amountKind, value: amountValue };
    if (date < minDate || date > maxDate) return setError("Pick a date within the timeline's start and end dates.");
    if ((type === "buy" || type === "sell" || type === "switch" || type === "recurring") && !ticker) return setError("Choose an investment.");
    if (type === "switch" && !toTicker) return setError("Choose what to switch into.");
    if (type === "switch" && toTicker === ticker) return setError("Pick a different investment to switch into.");
    if (amountKind === "percent" && (amountValue <= 0 || amountValue > 100) && "buy sell switch".includes(type)) return setError("Percent must be between 0 and 100.");
    if (amountKind !== "all" && amountValue <= 0 && "buy sell switch".includes(type)) return setError("Amount must be more than 0.");
    if ((type === "deposit" || type === "withdraw" || type === "recurring") && cashValue <= 0) return setError("Amount must be more than $0.");
    if (type === "recurring" && endDate && endDate <= date) return setError("End date must be after the start date.");

    switch (type) {
      case "buy": return onSubmit({ type, date, ticker, amount });
      case "sell": return onSubmit({ type, date, ticker, amount });
      case "switch": return onSubmit({ type, date, ticker, toTicker, amount });
      case "deposit": return onSubmit({ type, date, value: cashValue });
      case "withdraw": return onSubmit({ type, date, value: cashValue });
      case "recurring": return onSubmit({ type, date, ticker, value: cashValue, ...(endDate ? { endDate } : {}) });
    }
  }

  const kinds = type === "buy" ? BUY_KINDS : SELL_KINDS;

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-charcoal">Decision</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Kind)}
          className="w-full rounded-xl border border-slate-line bg-white px-3 py-2.5 text-base text-charcoal outline-none focus:border-blue"
          aria-label="Decision type"
        >
          {(Object.keys(ACTION_LABEL) as Kind[]).map((k) => (
            <option key={k} value={k}>{ACTION_LABEL[k]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label={type === "recurring" ? "First contribution" : "Date"} value={date} onChange={setDate} min={minDate} max={maxDate} />
        {type === "recurring" && <DateField label="Stop after (optional)" value={endDate} onChange={setEndDate} min={date} max={maxDate} />}
      </div>

      {(type === "buy" || type === "sell" || type === "switch" || type === "recurring") && (
        <TickerPick label={type === "switch" ? "Switch out of" : "Investment"} value={ticker} onChange={setTicker} suggestions={suggestions} />
      )}
      {type === "switch" && <TickerPick label="Switch into" value={toTicker} onChange={setToTicker} suggestions={suggestions.filter((s) => s !== ticker)} />}

      {(type === "buy" || type === "sell" || type === "switch") && (
        <div className="space-y-3">
          <Segmented label="Amount type" options={kinds} value={amountKind} onChange={setAmountKind} size="sm" />
          {amountKind !== "all" && (
            <NumberField
              label={amountKind === "dollars" ? "Amount" : amountKind === "shares" ? "Shares" : "Percent"}
              prefix={amountKind === "dollars" ? "$" : undefined}
              suffix={amountKind === "percent" ? "%" : undefined}
              value={amountValue}
              onChange={setAmountValue}
              min={0}
              max={amountKind === "percent" ? 100 : undefined}
              step={amountKind === "shares" ? 1 : amountKind === "percent" ? 5 : 100}
            />
          )}
        </div>
      )}

      {(type === "deposit" || type === "withdraw" || type === "recurring") && (
        <NumberField label={type === "recurring" ? "Monthly amount" : "Amount"} prefix="$" value={cashValue} onChange={setCashValue} min={0} step={100} />
      )}

      {type === "recurring" && <p className="text-xs text-muted">Each month: adds this cash, then buys the investment at that day&rsquo;s close.</p>}
      {(type === "buy" || type === "sell" || type === "switch") && (
        <p className="text-xs text-muted">Executes at that day&rsquo;s closing price, or the next trading day&rsquo;s close if the market was closed.</p>
      )}

      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit}>{initial ? "Save change" : "Add decision"}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

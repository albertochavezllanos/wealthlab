"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchTickers } from "@/lib/client/data";
import type { SearchResult } from "@/lib/types";

/**
 * Search box for stocks, ETFs, mutual funds, and crypto.
 * Pick from suggestions, or press Enter to use the typed ticker directly.
 */
export function TickerSearch({
  onSelect,
  placeholder = "Search a company, ETF, fund, or crypto (e.g. Apple, VOO, Bitcoin)",
  autoFocus,
  compact,
}: {
  onSelect: (r: { ticker: string; name?: string }) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setResults([]);
      setError(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      searchTickers(term)
        .then((r) => {
          if (!alive) return;
          setResults(r);
          setError(null);
          setActive(0);
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(r: { ticker: string; name?: string }) {
    onSelect(r);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
      else if (/^[A-Za-z0-9.\-]{1,15}$/.test(q.trim())) choose({ ticker: q.trim().toUpperCase() });
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && q.trim().length > 0;

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border border-slate-line bg-white px-3 shadow-card transition focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/15 ${
          compact ? "" : "sm:px-4"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6878" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-label="Search investments"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent text-charcoal outline-none placeholder:text-muted/70 ${compact ? "py-2 text-sm" : "py-3 text-base"}`}
        />
        {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-line border-t-blue" />}
      </div>

      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-slate-line bg-white py-1 shadow-lift"
        >
          {error && <li className="px-4 py-3 text-sm text-negative">{error}</li>}
          {!error && !loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted">
              No matches. Press Enter to try &ldquo;{q.trim().toUpperCase()}&rdquo; as a ticker.
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.ticker} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === active ? "bg-slate" : ""}`}
              >
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{r.ticker}</span>
                  <span className="ml-2 truncate text-sm text-muted">{r.name}</span>
                </span>
                <span className="shrink-0 rounded-full bg-slate px-2 py-0.5 text-[11px] font-medium text-charcoal">{r.assetType}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

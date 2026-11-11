"use client";

import { useEffect, useState } from "react";
import type { PriceHistory, SearchResult } from "@/lib/types";

/** Browser-side cache so switching tabs/ranges never refetches. */
const historyCache = new Map<string, Promise<PriceHistory>>();

export class FetchError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Load JSON from one of our API routes, with a reload function. `url = null` means "don't load yet". */
export function useJson<T>(url: string | null): Loadable<T> & { reload: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "idle" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    getJson<T>(nonce ? `${url}${url.includes("?") ? "&" : "?"}r=${nonce}` : url)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e: FetchError) => alive && setState({ status: "error", error: e.message, code: e.code }));
    return () => {
      alive = false;
    };
  }, [url, nonce]);
  return { ...state, reload: () => setNonce(Date.now()) } as Loadable<T> & { reload: () => void };
}

export async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new FetchError("Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) {
      window.location.assign("/access");
    }
    throw new FetchError(data?.error ?? `Request failed (${res.status}).`, data?.code);
  }
  return data as T;
}

export function fetchHistory(ticker: string): Promise<PriceHistory> {
  const t = ticker.trim().toUpperCase();
  let p = historyCache.get(t);
  if (!p) {
    p = getJson<PriceHistory>(`/api/history?ticker=${encodeURIComponent(t)}`);
    historyCache.set(t, p);
    p.catch(() => historyCache.delete(t)); // allow retry after errors
  }
  return p;
}

export async function searchTickers(q: string): Promise<SearchResult[]> {
  const data = await getJson<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`);
  return data.results;
}

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string; code?: string }
  | { status: "ready"; data: T };

export function useHistory(ticker: string | null): Loadable<PriceHistory> {
  const [state, setState] = useState<Loadable<PriceHistory>>({ status: "idle" });
  useEffect(() => {
    if (!ticker) {
      setState({ status: "idle" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    fetchHistory(ticker)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e: FetchError) => alive && setState({ status: "error", error: e.message, code: e.code }));
    return () => {
      alive = false;
    };
  }, [ticker]);
  return state;
}

/** Load several histories at once; reports per-ticker errors. */
export function useHistories(tickers: string[]) {
  const key = tickers.map((t) => t.toUpperCase()).join(",");
  const [state, setState] = useState<{
    loading: boolean;
    data: Record<string, PriceHistory>;
    errors: Record<string, string>;
  }>({ loading: false, data: {}, errors: {} });

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setState({ loading: false, data: {}, errors: {} });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.allSettled(list.map((t) => fetchHistory(t))).then((results) => {
      if (!alive) return;
      const data: Record<string, PriceHistory> = {};
      const errors: Record<string, string> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") data[list[i]] = r.value;
        else errors[list[i]] = (r.reason as Error).message;
      });
      setState({ loading: false, data, errors });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

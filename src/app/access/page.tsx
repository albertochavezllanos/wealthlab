"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function AccessPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // Only allow same-site relative paths
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(target);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-deep px-4">
      {/* Soft decorative backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-blue/30 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-copper/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo light />
        </div>
        <div className="rounded-2xl bg-ivory p-8 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">Private demo</p>
          <h1 className="mt-2 font-serif text-2xl font-medium text-navy">Enter the demo passcode</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            WealthLab is an educational prototype shared privately. Market data is end-of-day and licensed for
            personal use only.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="sr-only">Passcode</span>
              <input
                type="password"
                autoComplete="off"
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className="w-full rounded-xl border border-slate-line bg-white px-4 py-3 text-base text-charcoal outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !passcode.trim()}
              className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Checking…" : "Enter WealthLab"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-white/60">
          Educational prototype — not investment advice. Not affiliated with any financial firm.
        </p>
      </div>
    </div>
  );
}
